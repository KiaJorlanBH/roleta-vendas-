"use strict";

(() => {
  const sourceConfig = window.JORLAN_SUPABASE_CONFIG || {};
  const config = {
    url: typeof sourceConfig.url === "string" ? sourceConfig.url.trim() : "",
    anonKey: typeof sourceConfig.anonKey === "string" ? sourceConfig.anonKey.trim() : "",
    managerEmail: typeof sourceConfig.managerEmail === "string"
      ? sourceConfig.managerEmail.trim()
      : ""
  };
  const isConfigured = Boolean(config.url && config.anonKey && config.managerEmail);
  const client = isConfigured && window.supabase?.createClient
    ? window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "jorlan-manager-auth-v1"
      }
    })
    : null;

  function requireClient() {
    if (!isConfigured || !client) {
      throw new Error("Supabase ainda não está configurado neste projeto.");
    }
    return client;
  }

  function mapPosition(position) {
    return {
      id: position.id,
      name: position.name,
      cost: Number(position.estimated_cost ?? position.cost),
      color: position.color,
      index: Number(position.slot_index ?? position.index)
    };
  }

  function mapVendor(vendor) {
    return {
      id: vendor.id,
      storeId: vendor.store_id ?? vendor.storeId,
      name: vendor.name,
      active: vendor.active
    };
  }

  function mapRound(round) {
    return {
      id: round.id,
      date: round.created_at ?? round.date,
      storeId: round.store_id ?? round.storeId,
      storeName: round.store_name ?? round.storeName,
      sellerId: round.seller_id ?? round.sellerId,
      sellerName: round.seller_name ?? round.sellerName,
      prizeId: round.prize_id ?? round.prizeId,
      prizeName: round.prize_name ?? round.prizeName,
      estimatedCost: Number(round.estimated_cost ?? round.estimatedCost),
      positionIndex: round.position_index ?? round.positionIndex ?? null,
      delivered: round.delivered,
      deliveredAt: round.delivered_at ?? round.deliveredAt ?? null
    };
  }

  async function loadPublicStore(storeId) {
    const { data, error } = await requireClient().rpc("public_wheel_config", {
      p_store_id: storeId
    });
    if (error) throw error;
    if (!data || typeof data !== "object" || data.store?.id !== storeId ||
        !Array.isArray(data.vendors) || !Array.isArray(data.positions)) {
      throw new Error(`O serviço retornou uma configuração inválida para a loja ${storeId}.`);
    }
    return {
      store: data.store,
      vendors: data.vendors.map((vendor) => ({
        ...mapVendor(vendor),
        storeId: data.store.id,
        active: true
      })),
      positions: data.positions.map(mapPosition)
    };
  }

  async function loadManagerData() {
    const supabase = requireClient();
    const { data: manager, error: managerError } = await supabase.rpc("is_manager");
    if (managerError) throw managerError;
    if (manager !== true) throw new Error("A conta autenticada não tem acesso de gerente.");

    const [vendorsResult, positionsResult] = await Promise.all([
      supabase.from("vendors").select("id,store_id,name,active").order("name"),
      supabase.from("prize_positions").select("id,store_id,slot_index,name,estimated_cost,color")
        .order("store_id").order("slot_index")
    ]);
    for (const result of [vendorsResult, positionsResult]) {
      if (result.error) throw result.error;
    }

    const allRounds = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("rounds")
        .select("id,created_at,store_id,store_name,seller_id,seller_name,prize_id,prize_name,position_index,estimated_cost,delivered,delivered_at")
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      if (error) throw error;
      allRounds.push(...data);
      if (data.length < 1000) break;
    }

    const configurations = {};
    for (const position of positionsResult.data) {
      (configurations[position.store_id] ||= []).push(mapPosition(position));
    }
    return {
      vendors: vendorsResult.data.map(mapVendor),
      storeConfigurations: configurations,
      rounds: allRounds.map(mapRound)
    };
  }

  function subscribeToChanges(onChange) {
    return requireClient()
      .channel("jorlan-wheel-admin-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendors" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "prize_positions" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds" }, onChange)
      .subscribe();
  }

  async function recordPublicSpin(storeId, sellerId, idempotencyKey) {
    const { data, error } = await requireClient().functions.invoke("public-spin", {
      body: { storeId, sellerId, idempotencyKey }
    });
    if (error) throw error;
    return {
      id: data.roundId,
      positionIndex: Number(data.positionIndex),
      prizeId: data.prizeId,
      prizeName: data.prizeName,
      estimatedCost: Number(data.estimatedCost),
      positions: data.positions.map(mapPosition),
      date: data.createdAt,
      delivered: data.delivered
    };
  }

  async function saveVendor(vendor) {
    const supabase = requireClient();
    const payload = {
      id: vendor.id,
      store_id: vendor.storeId,
      name: vendor.name,
      active: vendor.active
    };
    const { data, error } = await supabase.from("vendors").upsert(payload).select().single();
    if (error) throw error;
    return mapVendor(data);
  }

  async function deleteVendor(vendorId) {
    const { error } = await requireClient().from("vendors").delete().eq("id", vendorId);
    if (error) throw error;
  }

  async function saveStorePositions(storeId, positions) {
    const { error } = await requireClient().rpc("manager_save_store_positions", {
      p_store_id: storeId,
      p_positions: positions.map((position) => ({
        id: position.id,
        name: position.name,
        cost: position.cost,
        color: position.color
      }))
    });
    if (error) throw error;
  }

  async function markRoundDelivered(roundId) {
    const { data, error } = await requireClient().from("rounds")
      .update({ delivered: true, delivered_at: new Date().toISOString() })
      .eq("id", roundId)
      .eq("delivered", false)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("A rodada já foi entregue ou não existe.");
    return mapRound(data);
  }

  async function importBackup(backup) {
    const { data, error } = await requireClient().rpc("manager_import_backup", {
      p_backup: backup
    });
    if (error) throw error;
    return data;
  }

  window.jorlanSupabase = {
    config,
    client,
    isConfigured,
    loadPublicStore,
    loadManagerData,
    subscribeToChanges,
    recordPublicSpin,
    saveVendor,
    deleteVendor,
    saveStorePositions,
    markRoundDelivered,
    importBackup,
    mapRound
  };
})();
