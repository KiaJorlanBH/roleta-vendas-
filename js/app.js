"use strict";

(() => {
  const MANAGER_SESSION_KEY = "jorlan-sales-wheel-manager-session-v1";
  const isManagerPage = new URLSearchParams(window.location.search).get("painel") === "1";
  if (isManagerPage && window.sessionStorage.getItem(MANAGER_SESSION_KEY) !== "authenticated") {
    window.location.replace("login.html");
    return;
  }

  const supabaseBackend = window.jorlanSupabase;
  const remoteMode = Boolean(supabaseBackend && supabaseBackend.isConfigured);
  const SEGMENT_COUNT = 40;
  const FULL_TURN = Math.PI * 2;
  const POINTER_ANGLE = -Math.PI / 2;
  const STORAGE_KEY = "jorlan-sales-wheel-config-v1";
  const STORE_CONFIG_STORAGE_KEY = "jorlan-sales-wheel-store-config-v1";
  const VENDORS_STORAGE_KEY = "jorlan-sales-wheel-vendors-v1";
  const ROUNDS_STORAGE_KEY = "jorlan-sales-wheel-rounds-v1";
  const SPIN_LOCK_STORAGE_KEY = "jorlan-sales-wheel-spin-lock-v1";
  const PENDING_SPIN_SESSION_KEY = "jorlan-sales-wheel-pending-spin-v1";
  const BACKUP_META_STORAGE_KEY = "jorlan-sales-wheel-backup-meta-v1";
  const STORES = [
    { id: "renault-barao", name: "RENAULT BARÃO" },
    { id: "kia-jorlan", name: "KIA JORLAN" },
    { id: "renault-pampulha", name: "RENAULT PAMPULHA" }
  ];
  const COLORS = ["#d94f4d", "#173451", "#d9a83f", "#286e71", "#754e72", "#bc704b", "#294f78", "#bf8e38"];
  const COLOR_FAMILY_COUNT = 10;
  const VIVID_COLOR_SHADES = [
    { saturation: 86, lightness: 43 },
    { saturation: 82, lightness: 54 },
    { saturation: 78, lightness: 65 },
    { saturation: 90, lightness: 48 }
  ];
  const VIVID_COLOR_PALETTE = VIVID_COLOR_SHADES.flatMap((shade, shadeIndex) =>
    Array.from({ length: COLOR_FAMILY_COUNT }, (_, family) => ({
      hue: family * 360 / COLOR_FAMILY_COUNT,
      family,
      shade: shadeIndex,
      ...shade
    }))
  );
  const DEFAULT_GROUPS = [
    { name: "Chocolate ou bombom", quantity: 6, cost: 4, color: "#d94f4d" },
    { name: "Refrigerante ou suco", quantity: 5, cost: 5, color: "#173451" },
    { name: "Café especial", quantity: 4, cost: 5, color: "#d9a83f" },
    { name: "Salgado ou pão de queijo", quantity: 4, cost: 7, color: "#286e71" },
    { name: "Pix de R$ 5", quantity: 4, cost: 5, color: "#754e72" },
    { name: "Pix de R$ 10", quantity: 4, cost: 10, color: "#bc704b" },
    { name: "Pix de R$ 20", quantity: 2, cost: 20, color: "#294f78" },
    { name: "Pix de R$ 30", quantity: 1, cost: 30, color: "#bf8e38" },
    { name: "Pix de R$ 50", quantity: 1, cost: 50, color: "#d94f4d" },
    { name: "Açaí pequeno", quantity: 2, cost: 12, color: "#173451" },
    { name: "Sobremesa", quantity: 2, cost: 10, color: "#d9a83f" },
    { name: "Café da manhã", quantity: 2, cost: 15, color: "#286e71" },
    { name: "Lanche especial", quantity: 2, cost: 20, color: "#754e72" },
    { name: "Prêmio surpresa", quantity: 1, cost: 15, color: "#bc704b" }
  ];
  const INITIAL_VENDORS = [
    { storeId: "renault-barao", names: ["LUCAS PERDIGÃO", "LEONARDO", "ANDRE", "MARCIO", "TULIO", "BRUNO", "CAROL"] },
    { storeId: "kia-jorlan", names: ["MATEUS", "ROGERIO", "GRAZIELE"] },
    { storeId: "renault-pampulha", names: ["FLAVIO", "GABRIEL", "RAFAELA", "JOÃO", "GLAUCIA", "MARCOS"] }
  ];

  const wheelCanvas = document.querySelector("#wheel");
  const confettiCanvas = document.querySelector("#confetti");
  const spinButton = document.querySelector("#spin-button");
  const soundToggle = document.querySelector("#sound-toggle");
  const soundTestPanel = document.querySelector("#sound-test-panel");
  const soundTestFeedback = document.querySelector("#sound-test-feedback");
  const buttonLabel = document.querySelector("#button-label");
  const resultLabel = document.querySelector("#result-label");
  const resultValue = document.querySelector("#result-value");
  const resultMeta = document.querySelector("#result-meta");
  const prizeCard = document.querySelector("#prize-card");
  const adminPanel = document.querySelector("#admin");
  const gameSection = document.querySelector(".game");
  const introSection = document.querySelector(".intro");
  const openAdminButton = document.querySelector("#open-admin");
  const closeAdminButton = document.querySelector("#close-admin");
  const exportBackupButton = document.querySelector("#export-backup");
  const importBackupButton = document.querySelector("#import-backup-button");
  const importBackupInput = document.querySelector("#import-backup");
  const backupStatus = document.querySelector("#backup-status");
  const backupFeedback = document.querySelector("#backup-feedback");
  const vendorPane = document.querySelector("#vendor-pane");
  const prizePane = document.querySelector("#prize-pane");
  const historyPane = document.querySelector("#history-pane");
  const prizeRows = document.querySelector("#prize-rows");
  const prizeStoreSelect = document.querySelector("#prize-store");
  const slicePreview = document.querySelector("#slice-preview");
  const positionCount = document.querySelector("#position-count");
  const totalCost = document.querySelector("#total-cost");
  const averageCost = document.querySelector("#average-cost");
  const adminFeedback = document.querySelector("#admin-feedback");
  const saveButton = document.querySelector("#save-config");
  const importInput = document.querySelector("#import-config");
  const spinStore = document.querySelector("#spin-store");
  const spinSeller = document.querySelector("#spin-seller");
  const confirmDeliveryButton = document.querySelector("#confirm-delivery");
  const spinBlockMessage = document.querySelector("#spin-block-message");
  const vendorForm = document.querySelector("#vendor-form");
  const vendorNameInput = document.querySelector("#vendor-name");
  const vendorStoreInput = document.querySelector("#vendor-store");
  const vendorStoreFilter = document.querySelector("#vendor-store-filter");
  const vendorSearch = document.querySelector("#vendor-search");
  const showInactiveVendors = document.querySelector("#show-inactive-vendors");
  const vendorStoreCounts = document.querySelector("#vendor-store-counts");
  const showVendorFormButton = document.querySelector("#show-vendor-form");
  const vendorSubmit = document.querySelector("#vendor-submit");
  const vendorCancel = document.querySelector("#vendor-cancel");
  const vendorRows = document.querySelector("#vendor-rows");
  const vendorFeedback = document.querySelector("#vendor-feedback");
  const historyStore = document.querySelector("#history-store");
  const historySeller = document.querySelector("#history-seller");
  const historyFrom = document.querySelector("#history-from");
  const historyTo = document.querySelector("#history-to");
  const historyRows = document.querySelector("#history-rows");
  const storeHistoryTotals = document.querySelector("#store-history-totals");
  const historyCount = document.querySelector("#history-count");
  const historyCost = document.querySelector("#history-cost");
  const historyDelivered = document.querySelector("#history-delivered");
  const historyFeedback = document.querySelector("#history-feedback");
  const wheelContext = wheelCanvas.getContext("2d");
  const confettiContext = confettiCanvas.getContext("2d");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let positions = createDefaultPositions();
  let storeConfigurations = {};
  let selectedPrizeStoreId = STORES[0].id;
  let vendors = [];
  let rounds = [];
  let draftGroups = [];
  let draftPositions = [];
  let rotation = 0;
  let highlightedIndex = -1;
  let isSpinning = false;
  let resizeFrame = 0;
  let spinAnimationFrame = 0;
  let spinUnlockTimer = 0;
  let confettiFrame = 0;
  let startupMessage = "";
  let editingVendorId = null;
  let activeRoundId = null;
  let releaseSpinLock = null;
  let remoteReady = false;
  let remoteLoadError = "";
  let remoteConfiguredStoreIds = new Set();
  let remoteRefreshRequested = false;
  let remoteRefreshPromise = null;
  let remoteRefreshTimer = 0;
  let remoteSyncChannel = null;
  let audioContext = null;
  let audioMasterGain = null;
  let wheelTickNoiseBuffer = null;
  let soundEnabled = true;
  let spinSoundActive = false;
  const activeAudioNodes = new Map();
  const audioPreviewTimers = [];
  let pendingSpinRequest = remoteMode ? readPendingSpinRequest() : null;
  const wheelLabelLayoutCache = new Map();
  const tabId = createId();

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const bytes = window.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    return `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  function createIdempotencyKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const bytes = window.crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    throw new Error("Este navegador não oferece geração segura de identificadores para giros.");
  }

  function readPendingSpinRequest() {
    const saved = window.sessionStorage.getItem(PENDING_SPIN_SESSION_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const isUuid = typeof parsed?.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.id);
    if (!isUuid || !STORES.some((store) => store.id === parsed.storeId) ||
        typeof parsed.sellerId !== "string" || !parsed.sellerId) {
      window.sessionStorage.removeItem(PENDING_SPIN_SESSION_KEY);
      throw new Error("A solicitação de giro pendente nesta sessão está inválida. Recarregue a página.");
    }
    return { id: parsed.id, storeId: parsed.storeId, sellerId: parsed.sellerId };
  }

  function hslToHex({ hue, saturation, lightness }) {
    const saturationRatio = saturation / 100;
    const lightnessRatio = lightness / 100;
    const chroma = (1 - Math.abs(2 * lightnessRatio - 1)) * saturationRatio;
    const hueSection = hue / 60;
    const secondary = chroma * (1 - Math.abs(hueSection % 2 - 1));
    const offset = lightnessRatio - chroma / 2;
    const channels = hueSection < 1 ? [chroma, secondary, 0]
      : hueSection < 2 ? [secondary, chroma, 0]
        : hueSection < 3 ? [0, chroma, secondary]
          : hueSection < 4 ? [0, secondary, chroma]
            : hueSection < 5 ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
    return `#${channels.map((channel) =>
      Math.round((channel + offset) * 255).toString(16).padStart(2, "0")
    ).join("")}`;
  }

  function createBalancedColorOrder() {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      const shuffled = [];
      for (const shade of VIVID_COLOR_SHADES.keys()) {
        const familyColors = VIVID_COLOR_PALETTE.filter((color) => color.shade === shade);
        for (let index = familyColors.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [familyColors[index], familyColors[swapIndex]] = [familyColors[swapIndex], familyColors[index]];
        }
        shuffled.push(...familyColors);
      }

      const hasRepeatedFamilies = shuffled.some((color, index) =>
        color.family === shuffled[(index + 1) % shuffled.length].family
      );
      if (!hasRepeatedFamilies) return shuffled.map(hslToHex);
    }

    throw new Error("Não foi possível gerar uma distribuição equilibrada de cores.");
  }

  function randomizePositionColors(source) {
    const colors = createBalancedColorOrder();
    return source.map((position, index) => ({ ...position, color: colors[index] }));
  }

  function createDefaultPositions() {
    const defaultPositions = DEFAULT_GROUPS.flatMap((group) =>
      Array.from({ length: group.quantity }, () => ({
        id: createId(),
        name: group.name,
        cost: group.cost,
        color: group.color
      }))
    );
    return randomizePositionColors(defaultPositions);
  }

  function normalizeAngle(angle) {
    return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  function validatePositions(candidate) {
    if (!Array.isArray(candidate) || candidate.length !== SEGMENT_COUNT) {
      throw new Error("A configuração precisa conter exatamente 40 posições.");
    }

    const ids = new Set();
    for (const [index, position] of candidate.entries()) {
      if (!position || typeof position !== "object" || Array.isArray(position)) {
        throw new Error(`A posição ${index + 1} é inválida.`);
      }
      if (typeof position.id !== "string" || !position.id.trim() || position.id.length > 128 || ids.has(position.id)) {
        throw new Error(`O ID da posição ${index + 1} está ausente ou duplicado.`);
      }
      if (typeof position.name !== "string" || !position.name.trim() || position.name.trim().length > 80) {
        throw new Error(`O nome da posição ${index + 1} deve ter de 1 a 80 caracteres.`);
      }
      if (typeof position.cost !== "number" || !Number.isFinite(position.cost) || position.cost < 0 || position.cost > 1000000) {
        throw new Error(`O custo da posição ${index + 1} deve ser um número entre R$ 0 e R$ 1.000.000.`);
      }
      if (typeof position.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(position.color)) {
        throw new Error(`A cor da posição ${index + 1} deve estar no formato hexadecimal #RRGGBB.`);
      }
      ids.add(position.id);
    }

    return candidate.map((position) => ({
      id: position.id,
      name: position.name.trim(),
      cost: position.cost,
      color: position.color.toLowerCase()
    }));
  }

  function readStoredPositions() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === null) return;
      const parsed = JSON.parse(saved);
      if (!parsed || parsed.version !== 1) {
        throw new Error("A versão da configuração salva não é compatível.");
      }
      positions = validatePositions(parsed.positions);
    } catch (error) {
      startupMessage = `Não foi possível carregar a configuração salva: ${error.message} A configuração inicial será usada.`;
      positions = createDefaultPositions();
    }
  }

  async function deleteVendor(vendorId) {
    const vendor = vendors.find((entry) => entry.id === vendorId);
    if (!vendor) return;
    if (rounds.some((round) => round.sellerId === vendorId)) {
      setManagementFeedback(vendorFeedback, "Este vendedor tem histórico e não pode ser excluído.", "error");
      return;
    }
    if (!window.confirm(`Excluir definitivamente ${vendor.name}? Esta ação não pode ser desfeita.`)) return;
    try {
      if (remoteMode) {
        await supabaseBackend.deleteVendor(vendorId);
        vendors = vendors.filter((entry) => entry.id !== vendorId);
      } else {
        vendors = persistCollection(
          VENDORS_STORAGE_KEY,
          vendors.filter((entry) => entry.id !== vendorId),
          validateVendors
        );
      }
      if (editingVendorId === vendorId) resetVendorForm();
      refreshManagement();
      setManagementFeedback(vendorFeedback, `${vendor.name} foi excluído.`, "success");
    } catch (error) {
      setManagementFeedback(vendorFeedback, `Não foi possível excluir o vendedor: ${error.message}`, "error");
    }
  }

  function clonePositionsWithNewIds(source) {
    return randomizePositionColors(source.map((position) => ({ ...position, id: createId() })));
  }

  function migrateLegacyDefaultColors(source) {
    const defaultColorsByPrize = new Map(DEFAULT_GROUPS.map(({ name, color }) => [name, color]));
    const usesLegacyColors = source.every((position) =>
      defaultColorsByPrize.get(position.name) === position.color
    );
    return usesLegacyColors ? randomizePositionColors(source) : source;
  }

  function validateStoreConfigurations(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("As configurações por loja são inválidas.");
    }

    const configs = {};
    for (const store of STORES) {
      configs[store.id] = validatePositions(candidate[store.id]);
    }
    return configs;
  }

  function persistStoreConfigurations(candidate) {
    const validated = validateStoreConfigurations(candidate);
    window.localStorage.setItem(
      STORE_CONFIG_STORAGE_KEY,
      JSON.stringify({ version: 1, stores: validated })
    );
    storeConfigurations = validated;
    positions = storeConfigurations[spinStore.value] || storeConfigurations[selectedPrizeStoreId];
    return validated;
  }

  function loadStoreConfigurations() {
    const legacyPositions = positions;
    try {
      const saved = window.localStorage.getItem(STORE_CONFIG_STORAGE_KEY);
      if (saved === null) {
        storeConfigurations = Object.fromEntries(STORES.map((store, index) => [
          store.id,
          index === 0 ? legacyPositions : clonePositionsWithNewIds(legacyPositions)
        ]));
        persistStoreConfigurations(storeConfigurations);
        return;
      }

      const parsed = JSON.parse(saved);
      if (!parsed || parsed.version !== 1 || !parsed.stores || typeof parsed.stores !== "object") {
        throw new Error("A versão da configuração por loja não é compatível.");
      }

      const completedConfigs = {};
      STORES.forEach((store, index) => {
        completedConfigs[store.id] = parsed.stores[store.id]
          ? migrateLegacyDefaultColors(validatePositions(parsed.stores[store.id]))
          : index === 0 ? legacyPositions : clonePositionsWithNewIds(legacyPositions);
      });
      persistStoreConfigurations(completedConfigs);
    } catch (error) {
      startupMessage += `Não foi possível carregar as configurações por loja: ${error.message} `;
      storeConfigurations = Object.fromEntries(STORES.map((store, index) => [
        store.id,
        index === 0 ? legacyPositions : clonePositionsWithNewIds(legacyPositions)
      ]));
      positions = storeConfigurations[selectedPrizeStoreId];
    }
  }

  function saveCurrentStorePositions(candidate) {
    const nextConfigurations = {
      ...storeConfigurations,
      [selectedPrizeStoreId]: validatePositions(candidate)
    };
    persistStoreConfigurations(nextConfigurations);
  }

  function createInitialVendors() {
    const seeded = [...vendors];
    let added = 0;
    for (const storeGroup of INITIAL_VENDORS) {
      storeGroup.names.forEach((name, index) => {
        const alreadyExists = seeded.some((vendor) =>
          vendor.storeId === storeGroup.storeId &&
          vendor.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
        );
        if (alreadyExists) return;
        const seedId = `seed-${storeGroup.storeId}-${String(index + 1).padStart(2, "0")}`;
        seeded.push({
          id: seeded.some((vendor) => vendor.id === seedId) ? createId() : seedId,
          storeId: storeGroup.storeId,
          name,
          active: true
        });
        added += 1;
      });
    }
    if (added > 0) {
      vendors = persistCollection(VENDORS_STORAGE_KEY, seeded, validateVendors);
    }
  }

  async function refreshSupabaseData() {
    if (isSpinning) {
      remoteRefreshRequested = true;
      return;
    }
    if (remoteRefreshPromise) {
      remoteRefreshRequested = true;
      return remoteRefreshPromise;
    }
    remoteRefreshRequested = false;
    remoteRefreshPromise = loadSupabaseData();
    try {
      await remoteRefreshPromise;
    } finally {
      const refreshAgain = remoteRefreshRequested;
      remoteRefreshPromise = null;
      remoteRefreshRequested = false;
      if (refreshAgain && !isSpinning) {
        window.setTimeout(() => {
          refreshSupabaseData().catch((error) => {
            if (isManagerPage) {
              setManagementFeedback(historyFeedback, `Não foi possível sincronizar os dados: ${error.message}`, "error");
            } else {
              spinBlockMessage.textContent = `Não foi possível atualizar as configurações: ${error.message}`;
            }
          });
        }, 0);
      }
    }
  }

  async function loadSupabaseData() {
    let configurations;
    let nextVendors;
    let nextRounds = [];
    let configuredStoreIds;
    if (isManagerPage) {
      const managerData = await supabaseBackend.loadManagerData();
      adminPanel.hidden = false;
      nextVendors = validateVendors(managerData.vendors);
      configurations = {};
      configuredStoreIds = new Set();
      for (const store of STORES) {
        const savedPositions = managerData.storeConfigurations[store.id];
        if (savedPositions?.length === SEGMENT_COUNT) {
          configurations[store.id] = validatePositions(savedPositions);
          configuredStoreIds.add(store.id);
        } else {
          configurations[store.id] = createDefaultPositions();
        }
      }
      nextRounds = validateRounds(managerData.rounds);
    } else {
      const publicStores = await Promise.all(STORES.map((store) =>
        supabaseBackend.loadPublicStore(store.id)
      ));
      configurations = Object.fromEntries(publicStores.map(({ store, positions: storePositions }) => {
        if (storePositions.length !== SEGMENT_COUNT) {
          throw new Error(`${store.name} não possui exatamente ${SEGMENT_COUNT} fatias.`);
        }
        return [store.id, validatePositions(storePositions)];
      }));
      configuredStoreIds = new Set(STORES.map((store) => store.id));
      nextVendors = publicStores.flatMap(({ vendors: storeVendors }) => storeVendors);
    }

    storeConfigurations = configurations;
    remoteConfiguredStoreIds = configuredStoreIds;
    vendors = validateVendors(nextVendors);
    rounds = nextRounds;
    positions = storeConfigurations[spinStore.value] || storeConfigurations[STORES[0].id];
    if (!storeConfigurations[selectedPrizeStoreId]) selectedPrizeStoreId = STORES[0].id;
    draftPositions = storeConfigurations[selectedPrizeStoreId].map((position) => ({ ...position }));
    draftGroups = groupPositions(draftPositions);
    activeRoundId = activePendingRounds()[0]?.id || null;
    remoteReady = true;
    remoteLoadError = "";

    populateStoreOptions(vendorStoreInput);
    populateVendorStoreOptions();
    if (pendingSpinRequest && STORES.some((store) => store.id === pendingSpinRequest.storeId)) {
      spinStore.value = pendingSpinRequest.storeId;
    }
    prizeStoreSelect.value = selectedPrizeStoreId;
    refreshSpinSelectors();
    if (pendingSpinRequest) spinSeller.value = pendingSpinRequest.sellerId;
    updateSpinAvailability();
    renderVendorRows();
    renderHistory();
    renderPrizeRows();
    updateSpinAvailability();
    drawWheel();
    if (isManagerPage && remoteConfiguredStoreIds.size !== STORES.length) {
      const missingNames = STORES
        .filter((store) => !remoteConfiguredStoreIds.has(store.id))
        .map((store) => store.name)
        .join(", ");
      setManagementFeedback(
        backupFeedback,
        `Importe o backup local antes de publicar a roleta. Ainda faltam configurações de 40 fatias para: ${missingNames}.`,
        "error"
      );
    }
  }

  async function initializeSupabaseData() {
    try {
      await refreshSupabaseData();
      if (isManagerPage) {
        remoteSyncChannel = supabaseBackend.subscribeToChanges(() => {
          window.clearTimeout(remoteRefreshTimer);
          remoteRefreshTimer = window.setTimeout(() => {
            refreshSupabaseData().catch((error) => {
              setManagementFeedback(historyFeedback, `Não foi possível sincronizar os dados: ${error.message}`, "error");
            });
          }, 300);
        });
      } else {
        window.addEventListener("focus", () => {
          refreshSupabaseData().catch((error) => {
            spinBlockMessage.textContent = `Não foi possível atualizar as configurações: ${error.message}`;
          });
        });
        window.setInterval(() => {
          if (document.visibilityState !== "visible") return;
          refreshSupabaseData().catch((error) => {
            spinBlockMessage.textContent = `Não foi possível atualizar as configurações: ${error.message}`;
          });
        }, 60000);
      }
    } catch (error) {
      remoteReady = false;
      remoteLoadError = `Não foi possível carregar os dados online: ${error.message}`;
      spinBlockMessage.textContent = `Não foi possível carregar os dados online: ${error.message}`;
      if (isManagerPage) {
        setManagementFeedback(adminFeedback, `Não foi possível carregar os dados do Supabase: ${error.message}`, "error");
        adminPanel.hidden = true;
        if (/não tem acesso de gerente/i.test(error.message)) {
          window.sessionStorage.removeItem(MANAGER_SESSION_KEY);
          window.top.location.replace("login.html");
        }
      }
      updateSpinAvailability();
    }
  }

  function validateVendors(candidate) {
    if (!Array.isArray(candidate)) throw new Error("A lista de vendedores é inválida.");
    const ids = new Set();
    return candidate.map((vendor, index) => {
      if (!vendor || typeof vendor !== "object" || Array.isArray(vendor)) {
        throw new Error(`O vendedor ${index + 1} é inválido.`);
      }
      if (typeof vendor.id !== "string" || !vendor.id.trim() || ids.has(vendor.id)) {
        throw new Error(`O ID do vendedor ${index + 1} está ausente ou duplicado.`);
      }
      if (typeof vendor.name !== "string" || !vendor.name.trim() || vendor.name.trim().length > 80) {
        throw new Error(`O nome do vendedor ${index + 1} deve ter de 1 a 80 caracteres.`);
      }
      if (!STORES.some((store) => store.id === vendor.storeId)) {
        throw new Error(`A loja do vendedor ${index + 1} é inválida.`);
      }
      if (typeof vendor.active !== "boolean") {
        throw new Error(`O status do vendedor ${index + 1} é inválido.`);
      }
      ids.add(vendor.id);
      return {
        id: vendor.id,
        storeId: vendor.storeId,
        name: vendor.name.trim(),
        active: vendor.active
      };
    });
  }

  function validateRounds(candidate) {
    if (!Array.isArray(candidate)) throw new Error("O histórico de giros é inválido.");
    const ids = new Set();
    return candidate.map((round, index) => {
      if (!round || typeof round !== "object" || Array.isArray(round)) {
        throw new Error(`A rodada ${index + 1} é inválida.`);
      }
      if (typeof round.id !== "string" || !round.id.trim() || ids.has(round.id)) {
        throw new Error(`O ID da rodada ${index + 1} está ausente ou duplicado.`);
      }
      if (typeof round.date !== "string" || !Number.isFinite(Date.parse(round.date))) {
        throw new Error(`A data da rodada ${index + 1} é inválida.`);
      }
      if (!STORES.some((store) => store.id === round.storeId) || typeof round.storeName !== "string" || !round.storeName.trim()) {
        throw new Error(`A loja da rodada ${index + 1} é inválida.`);
      }
      if (typeof round.sellerId !== "string" || !round.sellerId.trim() || typeof round.sellerName !== "string" || !round.sellerName.trim()) {
        throw new Error(`O vendedor da rodada ${index + 1} é inválido.`);
      }
      if (typeof round.prizeId !== "string" || !round.prizeId.trim() || typeof round.prizeName !== "string" || !round.prizeName.trim()) {
        throw new Error(`O prêmio da rodada ${index + 1} é inválido.`);
      }
      if (typeof round.estimatedCost !== "number" || !Number.isFinite(round.estimatedCost) || round.estimatedCost < 0) {
        throw new Error(`O custo da rodada ${index + 1} é inválido.`);
      }
      if (typeof round.delivered !== "boolean" ||
          (round.deliveredAt !== null && (typeof round.deliveredAt !== "string" || !Number.isFinite(Date.parse(round.deliveredAt))))) {
        throw new Error(`O status de entrega da rodada ${index + 1} é inválido.`);
      }
      const positionIndex = round.positionIndex ?? null;
      if (positionIndex !== null && (!Number.isInteger(positionIndex) || positionIndex < 0 || positionIndex >= SEGMENT_COUNT)) {
        throw new Error(`O índice da fatia da rodada ${index + 1} é inválido.`);
      }
      ids.add(round.id);
      return {
        id: round.id,
        date: round.date,
        storeId: round.storeId,
        storeName: round.storeName,
        sellerId: round.sellerId,
        sellerName: round.sellerName,
        prizeId: round.prizeId,
        prizeName: round.prizeName,
        estimatedCost: round.estimatedCost,
        positionIndex,
        delivered: round.delivered,
        deliveredAt: round.deliveredAt
      };
    });
  }

  function readStoredCollection(key, validate, fallback, collectionName) {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved === null) return fallback;
      const parsed = JSON.parse(saved);
      if (!parsed || parsed.version !== 1) {
        throw new Error("A versão dos dados salvos não é compatível.");
      }
      return validate(parsed.items);
    } catch (error) {
      startupMessage += `Não foi possível carregar ${collectionName}: ${error.message} `;
      return fallback;
    }
  }

  function persistCollection(key, items, validate) {
    const validated = validate(items);
    window.localStorage.setItem(key, JSON.stringify({ version: 1, items: validated }));
    return validated;
  }

  function storeName(storeId) {
    return STORES.find((store) => store.id === storeId)?.name || "Loja desconhecida";
  }

  function activePendingRounds() {
    return rounds.filter((round) => !round.delivered);
  }

  function readSpinLock() {
    const saved = window.localStorage.getItem(SPIN_LOCK_STORAGE_KEY);
    if (saved === null) return null;

    let lock;
    try {
      lock = JSON.parse(saved);
    } catch {
      window.localStorage.removeItem(SPIN_LOCK_STORAGE_KEY);
      return null;
    }

    if (!lock || typeof lock.owner !== "string" || typeof lock.roundId !== "string" ||
        !Number.isFinite(lock.expiresAt) || lock.expiresAt <= Date.now()) {
      window.localStorage.removeItem(SPIN_LOCK_STORAGE_KEY);
      return null;
    }
    return lock;
  }

  function releaseStoredSpinLock(roundId) {
    const lock = readSpinLock();
    if (lock && lock.roundId === roundId) {
      window.localStorage.removeItem(SPIN_LOCK_STORAGE_KEY);
    }
  }

  async function acquireSpinLock(roundId) {
    const existing = readSpinLock();
    if (existing && existing.owner !== tabId) return false;

    const claim = {
      owner: tabId,
      roundId,
      expiresAt: Date.now() + 60 * 1000
    };
    window.localStorage.setItem(SPIN_LOCK_STORAGE_KEY, JSON.stringify(claim));
    await new Promise((resolve) => window.setTimeout(resolve, 80));

    const verified = readSpinLock();
    if (!verified || verified.owner !== tabId || verified.roundId !== roundId) return false;

    if (navigator.locks && typeof navigator.locks.request === "function") {
      let notifyLockResult;
      const lockResult = new Promise((resolve) => {
        notifyLockResult = resolve;
      });
      navigator.locks.request("jorlan-sales-wheel-spin", { ifAvailable: true }, (lock) => {
        if (!lock) {
          notifyLockResult(false);
          return undefined;
        }
        notifyLockResult(true);
        return new Promise((resolve) => {
          releaseSpinLock = resolve;
        });
      }).catch((error) => notifyLockResult(error));

      const result = await lockResult;
      if (result !== true) {
        releaseStoredSpinLock(roundId);
        if (result instanceof Error) throw result;
        return false;
      }
    }
    return true;
  }

  function extendStoredSpinLock(roundId) {
    const lock = readSpinLock();
    if (!lock || lock.owner !== tabId || lock.roundId !== roundId) {
      throw new Error("A trava da rodada foi perdida antes da confirmação.");
    }
    lock.expiresAt = Date.now() + 48 * 60 * 60 * 1000;
    window.localStorage.setItem(SPIN_LOCK_STORAGE_KEY, JSON.stringify(lock));
  }

  function formatDateTime(value) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium"
    }).format(new Date(value));
  }

  function makeOption(value, label) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    return option;
  }

  function populateStoreOptions(select, { includeAll = false, placeholder = "Selecione a loja" } = {}) {
    const previousValue = select.value;
    select.replaceChildren();
    if (includeAll) select.append(makeOption("", "Todas as lojas"));
    else select.append(makeOption("", placeholder));
    for (const store of STORES) {
      select.append(makeOption(store.id, store.name));
    }
    if (Array.from(select.options).some((option) => option.value === previousValue)) {
      select.value = previousValue;
    }
  }

  function refreshSpinSelectors() {
    const selectedStore = spinStore.value;
    populateStoreOptions(spinStore);
    if (STORES.some((store) => store.id === selectedStore)) spinStore.value = selectedStore;

    const selectedSeller = spinSeller.value;
    const eligibleVendors = vendors.filter((vendor) => vendor.active && vendor.storeId === spinStore.value);
    spinSeller.replaceChildren(makeOption("", eligibleVendors.length ? "Selecione o vendedor" : "Nenhum vendedor ativo"));
    for (const vendor of eligibleVendors) {
      spinSeller.append(makeOption(vendor.id, vendor.name));
    }
    spinSeller.disabled = eligibleVendors.length === 0;
    if (eligibleVendors.some((vendor) => vendor.id === selectedSeller)) spinSeller.value = selectedSeller;
    updateSpinAvailability();
  }

  function updateSpinAvailability() {
    const selectedVendor = vendors.find((vendor) =>
      vendor.active && vendor.id === spinSeller.value && vendor.storeId === spinStore.value
    );
    const pending = remoteMode ? [] : activePendingRounds();
    const hasIdentity = Boolean(spinStore.value && selectedVendor);
    let sharedLock = null;
    let lockError = null;
    if (!remoteMode) {
      try {
        sharedLock = readSpinLock();
      } catch (error) {
        lockError = error;
      }
    }
    const anotherTabSpinning = !remoteMode && sharedLock && sharedLock.owner !== tabId;
    window.clearTimeout(spinUnlockTimer);
    if (anotherTabSpinning) {
      spinUnlockTimer = window.setTimeout(
        updateSpinAvailability,
        Math.max(0, sharedLock.expiresAt - Date.now()) + 50
      );
    }
    const notReady = remoteMode && !remoteReady;
    const spinIsLocked = isSpinning || (!remoteMode && pending.length > 0) ||
      Boolean(anotherTabSpinning) || Boolean(lockError) || notReady;
    const keepRequestIdentity = remoteMode && Boolean(pendingSpinRequest);
    spinStore.disabled = spinIsLocked || keepRequestIdentity;
    spinSeller.disabled = spinIsLocked || keepRequestIdentity || vendors.filter((vendor) =>
      vendor.active && vendor.storeId === spinStore.value
    ).length === 0;
    spinButton.disabled = spinIsLocked || !hasIdentity;

    if (isSpinning) {
      spinBlockMessage.textContent = "A rodada está em andamento. Aguarde a roleta parar.";
    } else if (notReady) {
      spinBlockMessage.textContent = remoteLoadError || "Conectando ao serviço online da roleta…";
    } else if (pendingSpinRequest) {
      spinBlockMessage.textContent = "Não foi possível confirmar a rodada. Tente novamente para consultar a mesma solicitação.";
    } else if (pending.length > 0) {
      spinBlockMessage.textContent = `Confirme a entrega do prêmio da rodada ${pending[0].id} antes de iniciar outro giro.`;
    } else if (anotherTabSpinning) {
      spinBlockMessage.textContent = "A roleta está ativa em outra aba. Aguarde a confirmação da entrega.";
    } else if (lockError) {
      spinBlockMessage.textContent = `Não foi possível verificar o bloqueio da roleta: ${lockError.message}`;
    } else if (!spinStore.value) {
      spinBlockMessage.textContent = "Selecione a loja e o vendedor antes de girar.";
    } else if (!selectedVendor) {
      spinBlockMessage.textContent = "Selecione um vendedor ativo desta loja para habilitar o giro.";
    } else {
      spinBlockMessage.textContent = "";
    }

    const currentPending = activeRoundId
      ? pending.find((round) => round.id === activeRoundId)
      : pending[0];
    confirmDeliveryButton.hidden = remoteMode || !currentPending || isSpinning;
    confirmDeliveryButton.dataset.roundId = currentPending ? currentPending.id : "";
  }

  function populateVendorStoreOptions() {
    populateStoreOptions(vendorStoreInput);
    populateStoreOptions(vendorStoreFilter, { includeAll: true });
    populateStoreOptions(historyStore, { includeAll: true });
    populateStoreOptions(prizeStoreSelect, { placeholder: "Selecione a concessionária" });
  }

  function setManagementFeedback(element, message, kind = "") {
    element.textContent = message;
    element.className = `admin-feedback${kind ? ` admin-feedback--${kind}` : ""}`;
  }

  function renderVendorRows() {
    vendorRows.replaceChildren();
    const filterStore = vendorStoreFilter.value;
    const query = vendorSearch.value.trim().toLocaleLowerCase("pt-BR");
    const showInactive = showInactiveVendors.checked;
    vendorStoreCounts.replaceChildren();

    for (const store of STORES) {
      const storeVendors = vendors.filter((vendor) => vendor.storeId === store.id);
      const count = document.createElement("div");
      count.className = "vendor-store-count";
      const storeLabel = document.createElement("span");
      storeLabel.textContent = store.name;
      const activeCount = document.createElement("strong");
      activeCount.textContent = `${storeVendors.filter((vendor) => vendor.active).length} ativos`;
      count.append(storeLabel, activeCount);
      vendorStoreCounts.append(count);

      if (filterStore && store.id !== filterStore) continue;
      const filteredVendors = storeVendors
        .filter((vendor) => (showInactive || vendor.active) && vendor.name.toLocaleLowerCase("pt-BR").includes(query))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
      if (filteredVendors.length === 0 && query) continue;

      const groupRow = document.createElement("tr");
      groupRow.className = "vendor-group-row";
      const groupCell = document.createElement("th");
      groupCell.scope = "rowgroup";
      groupCell.colSpan = 4;
      groupCell.textContent = `${store.name} • ${storeVendors.filter((vendor) => vendor.active).length} vendedores ativos`;
      groupRow.append(groupCell);
      vendorRows.append(groupRow);

      if (filteredVendors.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.textContent = "Nenhum vendedor para exibir nesta concessionária.";
        row.append(cell);
        vendorRows.append(row);
      }

      for (const vendor of filteredVendors) {
        const row = document.createElement("tr");
        row.dataset.vendorId = vendor.id;
        const nameCell = document.createElement("td");
        nameCell.textContent = vendor.name;
        const statusCell = document.createElement("td");
        statusCell.textContent = vendor.active ? "Ativo" : "Inativo";
        statusCell.className = vendor.active ? "vendor-status--active" : "vendor-status--inactive";
        const roundsForVendor = rounds.filter((round) => round.sellerId === vendor.id).length;
        const historyCell = document.createElement("td");
        historyCell.textContent = `${roundsForVendor} giro(s)`;
        const actionsCell = document.createElement("td");

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "admin__row-action";
        editButton.dataset.editVendor = vendor.id;
        editButton.textContent = "EDITAR";
        actionsCell.append(editButton);

        const statusButton = document.createElement("button");
        statusButton.type = "button";
        statusButton.className = "admin__row-action";
        statusButton.dataset.toggleVendor = vendor.id;
        statusButton.textContent = vendor.active ? "DESATIVAR" : "REATIVAR";
        actionsCell.append(statusButton);

        if (roundsForVendor === 0) {
          const deleteButton = document.createElement("button");
          deleteButton.type = "button";
          deleteButton.className = "admin__row-action admin__row-action--danger";
          deleteButton.dataset.deleteVendor = vendor.id;
          deleteButton.textContent = "EXCLUIR";
          actionsCell.append(deleteButton);
        }

        row.append(nameCell, statusCell, historyCell, actionsCell);
        vendorRows.append(row);
      }
    }

    if (!vendorRows.children.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Nenhum vendedor corresponde à pesquisa.";
      row.append(cell);
      vendorRows.append(row);
    }
  }

  function populateHistorySellerFilter() {
    const selectedStore = historyStore.value;
    const previousSeller = historySeller.value;
    const uniqueSellers = new Map();
    for (const vendor of vendors) {
      if ((!selectedStore || vendor.storeId === selectedStore) && !uniqueSellers.has(vendor.id)) {
        uniqueSellers.set(vendor.id, { id: vendor.id, name: vendor.name, storeId: vendor.storeId });
      }
    }
    for (const round of rounds) {
      if ((!selectedStore || round.storeId === selectedStore) && !uniqueSellers.has(round.sellerId)) {
        uniqueSellers.set(round.sellerId, {
          id: round.sellerId,
          name: round.sellerName,
          storeId: round.storeId
        });
      }
    }

    historySeller.replaceChildren(makeOption("", "Todos os vendedores"));
    for (const seller of Array.from(uniqueSellers.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
      historySeller.append(makeOption(seller.id, `${seller.name} — ${storeName(seller.storeId)}`));
    }
    if (Array.from(historySeller.options).some((option) => option.value === previousSeller)) {
      historySeller.value = previousSeller;
    }
  }

  function localDateString(value) {
    const date = new Date(value);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  }

  function filteredRounds() {
    const from = historyFrom.value;
    const to = historyTo.value;
    if (from && to && from > to) return [];

    return rounds.filter((round) => {
      const date = localDateString(round.date);
      return (!historyStore.value || round.storeId === historyStore.value) &&
        (!historySeller.value || round.sellerId === historySeller.value) &&
        (!from || date >= from) &&
        (!to || date <= to);
    }).sort((left, right) => right.date.localeCompare(left.date));
  }

  function renderHistory() {
    populateHistorySellerFilter();
    const rows = filteredRounds();
    historyRows.replaceChildren();
    storeHistoryTotals.replaceChildren();
    for (const store of STORES) {
      const storeRounds = rounds.filter((round) => round.storeId === store.id);
      const total = storeRounds.reduce((sum, round) => sum + round.estimatedCost, 0);
      const card = document.createElement("div");
      card.className = "store-history-total";
      const name = document.createElement("span");
      name.textContent = store.name;
      const summary = document.createElement("strong");
      summary.textContent = `${storeRounds.length} giros • ${formatCurrency(total)}`;
      card.append(name, summary);
      storeHistoryTotals.append(card);
    }
    const total = rows.reduce((sum, round) => sum + round.estimatedCost, 0);
    const deliveredCount = rows.filter((round) => round.delivered).length;
    historyCount.textContent = String(rows.length);
    historyCost.textContent = formatCurrency(total);
    historyDelivered.textContent = `${deliveredCount} / ${rows.length}`;

    if (historyFrom.value && historyTo.value && historyFrom.value > historyTo.value) {
      setManagementFeedback(historyFeedback, "A data inicial não pode ser posterior à data final.", "error");
    } else {
      setManagementFeedback(historyFeedback, rows.length ? "" : "Nenhuma rodada encontrada para os filtros selecionados.");
    }

    for (const round of rows) {
      const row = document.createElement("tr");
      const values = [
        formatDateTime(round.date),
        round.storeName,
        round.sellerName,
        round.prizeName,
        formatCurrency(round.estimatedCost),
        round.id,
        round.delivered ? `Entregue em ${formatDateTime(round.deliveredAt)}` : "Pendente"
      ];
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }

      const actionCell = document.createElement("td");
      if (!round.delivered) {
        const confirmButton = document.createElement("button");
        confirmButton.type = "button";
        confirmButton.className = "admin__row-action";
        confirmButton.dataset.confirmRound = round.id;
        confirmButton.textContent = "CONFIRMAR ENTREGA";
        actionCell.append(confirmButton);
      } else {
        actionCell.textContent = "—";
      }
      row.append(actionCell);
      historyRows.append(row);
    }
  }

  function refreshManagement() {
    populateVendorStoreOptions();
    renderVendorRows();
    renderHistory();
    refreshSpinSelectors();
  }

  function startEditingVendor(vendorId) {
    const vendor = vendors.find((entry) => entry.id === vendorId);
    if (!vendor) return;
    showVendorForm(vendor);
    setManagementFeedback(vendorFeedback, `Editando cadastro de ${vendor.name}.`);
  }

  function resetVendorForm() {
    hideVendorForm();
  }

  async function saveVendor(event) {
    event.preventDefault();
    const name = vendorNameInput.value.trim();
    const storeId = vendorStoreInput.value;
    if (!name || name.length > 80 || !STORES.some((store) => store.id === storeId)) {
      setManagementFeedback(vendorFeedback, "Informe um nome válido e uma das três lojas.", "error");
      return;
    }
    const duplicate = vendors.some((vendor) =>
      vendor.id !== editingVendorId &&
      vendor.storeId === storeId &&
      vendor.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
    );
    if (duplicate) {
      setManagementFeedback(vendorFeedback, "Já existe um vendedor com esse nome nesta loja.", "error");
      return;
    }

    const wasEditing = Boolean(editingVendorId);
    const nextVendors = editingVendorId
      ? vendors.map((vendor) => vendor.id === editingVendorId ? { ...vendor, name, storeId } : vendor)
      : [...vendors, { id: createId(), name, storeId, active: true }];

    vendorSubmit.disabled = true;
    try {
      if (remoteMode) {
        const candidate = editingVendorId
          ? nextVendors.find((vendor) => vendor.id === editingVendorId)
          : nextVendors[nextVendors.length - 1];
        const savedVendor = await supabaseBackend.saveVendor(candidate);
        vendors = validateVendors([
          ...vendors.filter((vendor) => vendor.id !== savedVendor.id),
          savedVendor
        ]);
      } else {
        vendors = persistCollection(VENDORS_STORAGE_KEY, nextVendors, validateVendors);
      }
      resetVendorForm();
      refreshManagement();
      setManagementFeedback(vendorFeedback, wasEditing
        ? remoteMode ? "Alterações do vendedor sincronizadas com o banco online." : "Alterações do vendedor salvas neste navegador."
        : remoteMode ? "Vendedor cadastrado no banco online." : "Vendedor cadastrado neste navegador.", "success");
    } catch (error) {
      setManagementFeedback(vendorFeedback, `Não foi possível salvar o vendedor: ${error.message}`, "error");
    } finally {
      vendorSubmit.disabled = false;
    }
  }

  async function toggleVendor(vendorId) {
    const current = vendors.find((vendor) => vendor.id === vendorId);
    if (!current) return;
    if (current.active && !window.confirm(`Desativar ${current.name}? Ele não poderá participar de novos giros.`)) return;
    const nextVendors = vendors.map((vendor) =>
      vendor.id === vendorId ? { ...vendor, active: !vendor.active } : vendor
    );
    try {
      if (remoteMode) {
        const updatedVendor = await supabaseBackend.saveVendor(
          nextVendors.find((vendor) => vendor.id === vendorId)
        );
        vendors = validateVendors(vendors.map((vendor) =>
          vendor.id === vendorId ? updatedVendor : vendor
        ));
      } else {
        vendors = persistCollection(VENDORS_STORAGE_KEY, nextVendors, validateVendors);
      }
      if (editingVendorId === vendorId && !current.active) resetVendorForm();
      refreshManagement();
      setManagementFeedback(vendorFeedback, `${current.name} foi ${current.active ? "desativado" : "ativado"}.`, "success");
    } catch (error) {
      setManagementFeedback(vendorFeedback, `Não foi possível atualizar o vendedor: ${error.message}`, "error");
    }
  }

  async function confirmDelivery(roundId) {
    const round = rounds.find((entry) => entry.id === roundId);
    if (!round || round.delivered) return;
    const deliveredAt = new Date().toISOString();
    const nextRounds = rounds.map((entry) =>
      entry.id === roundId ? { ...entry, delivered: true, deliveredAt } : entry
    );
    try {
      if (remoteMode) {
        const updatedRound = await supabaseBackend.markRoundDelivered(roundId);
        rounds = validateRounds(rounds.map((entry) =>
          entry.id === roundId ? updatedRound : entry
        ));
      } else {
        rounds = persistCollection(ROUNDS_STORAGE_KEY, nextRounds, validateRounds);
      }
      if (activeRoundId === roundId) {
        activeRoundId = null;
      }
      if (!remoteMode) releaseStoredSpinLock(roundId);
      if (releaseSpinLock) {
        releaseSpinLock();
        releaseSpinLock = null;
      }
      refreshManagement();
      setManagementFeedback(historyFeedback, `Entrega da rodada ${roundId} confirmada.`, "success");
    } catch (error) {
      setManagementFeedback(historyFeedback, `Não foi possível confirmar a entrega: ${error.message}`, "error");
    }
  }

  function csvCell(value) {
    let text = String(value ?? "");
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function exportHistoryCsv() {
    const rows = filteredRounds();
    const header = ["ID da rodada", "Data e hora", "ID da loja", "Loja", "ID do vendedor", "Vendedor", "ID do prêmio", "Prêmio", "Custo estimado (R$)", "Entregue", "Data de entrega"];
    const csvRows = [header, ...rows.map((round) => [
      round.id,
      new Date(round.date).toLocaleString("pt-BR"),
      round.storeId,
      round.storeName,
      round.sellerId,
      round.sellerName,
      round.prizeId,
      round.prizeName,
      round.estimatedCost.toFixed(2).replace(".", ","),
      round.delivered ? "Sim" : "Não",
      round.deliveredAt ? new Date(round.deliveredAt).toLocaleString("pt-BR") : ""
    ])];
    const csv = `\uFEFF${csvRows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "historico-roleta-jorlan.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setManagementFeedback(historyFeedback, `${rows.length} rodada(s) exportada(s) em CSV.`, "success");
  }

  function readLegacyBackupConfig() {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return null;
    const parsed = JSON.parse(saved);
    if (!parsed || parsed.version !== 1) {
      throw new Error("A configuração legada da roleta não é compatível.");
    }
    return { version: 1, positions: validatePositions(parsed.positions) };
  }

  function updateBackupStatus(timestamp = null) {
    try {
      const lastBackup = timestamp ?? window.localStorage.getItem(BACKUP_META_STORAGE_KEY);
      if (!lastBackup || !Number.isFinite(Date.parse(lastBackup))) {
        backupStatus.textContent = "Último backup: ainda não registrado";
        return;
      }
      backupStatus.textContent = `Último backup: ${formatDateTime(lastBackup)}`;
    } catch (error) {
      backupStatus.textContent = `Data do backup indisponível: ${error.message}`;
    }
  }

  function downloadJsonFile(data, filename) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8"
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportFullBackup() {
    try {
      if (remoteMode && remoteConfiguredStoreIds.size !== STORES.length) {
        throw new Error("Não é possível exportar o backup completo antes de importar as três roletas do backup local.");
      }
      const createdAt = new Date().toISOString();
      const backup = {
        format: "jorlan-sales-wheel-backup",
        version: 1,
        createdAt,
        data: {
          legacyConfiguration: remoteMode ? null : readLegacyBackupConfig(),
          storeConfigurations: {
            version: 1,
            stores: validateStoreConfigurations(storeConfigurations)
          },
          vendors: validateVendors(vendors),
          rounds: validateRounds(rounds)
        }
      };
      downloadJsonFile(backup, "backup-roleta-jorlan.json");
      try {
        window.localStorage.setItem(BACKUP_META_STORAGE_KEY, createdAt);
        updateBackupStatus(createdAt);
      } catch (error) {
        backupStatus.textContent = `Backup baixado; não foi possível salvar a data: ${error.message}`;
      }
      setManagementFeedback(backupFeedback, "Backup completo exportado com vendedores, roletas e histórico.", "success");
    } catch (error) {
      setManagementFeedback(backupFeedback, `Não foi possível exportar o backup: ${error.message}`, "error");
    }
  }

  function validateBackup(parsed) {
    if (!parsed || parsed.format !== "jorlan-sales-wheel-backup" || parsed.version !== 1 ||
        !parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) {
      throw new Error("O arquivo não é um backup Jorlan compatível.");
    }
    if (typeof parsed.createdAt !== "string" || !Number.isFinite(Date.parse(parsed.createdAt))) {
      throw new Error("A data do backup está ausente ou inválida.");
    }

    let legacyConfiguration = null;
    if (parsed.data.legacyConfiguration !== null) {
      const legacy = parsed.data.legacyConfiguration;
      if (!legacy || legacy.version !== 1) {
        throw new Error("A configuração legada do backup é inválida.");
      }
      legacyConfiguration = { version: 1, positions: validatePositions(legacy.positions) };
    }
    const importedConfigurations = parsed.data.storeConfigurations;
    if (!importedConfigurations || importedConfigurations.version !== 1) {
      throw new Error("As configurações por concessionária do backup são inválidas.");
    }

    return {
      legacyConfiguration,
      storeConfigurations: validateStoreConfigurations(importedConfigurations.stores),
      vendors: validateVendors(parsed.data.vendors),
      rounds: validateRounds(parsed.data.rounds)
    };
  }

  async function importFullBackup() {
    const file = importBackupInput.files[0];
    if (!file) return;
    try {
      const activeLock = remoteMode ? null : readSpinLock();
      if (isSpinning || (activeLock && activeLock.owner !== tabId)) {
        setManagementFeedback(backupFeedback, "Aguarde o fim do giro em andamento antes de importar um backup.", "error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("O arquivo deve ter no máximo 10 MB.");
      }
      const parsed = JSON.parse(await file.text());
      const imported = validateBackup(parsed);
      if (!window.confirm(
        remoteMode
          ? `Importar para o banco online vendedores, roletas e histórico do backup de ${formatDateTime(parsed.createdAt)}? IDs existentes serão ignorados, sem apagar dados.`
          : `Substituir vendedores, configurações das três roletas e histórico pelos dados do backup de ${formatDateTime(parsed.createdAt)}? Esta ação não pode ser desfeita.`
      )) {
        setManagementFeedback(backupFeedback, "Importação cancelada. Nenhum dado foi alterado.");
        return;
      }

      if (remoteMode) {
        const inserted = await supabaseBackend.importBackup(parsed);
        await refreshSupabaseData();
        setManagementFeedback(
          backupFeedback,
          `Migração concluída: ${inserted.insertedVendors} novos vendedores, ${Number(inserted.updatedSeedVendors || 0)} vendedores iniciais atualizados, ${inserted.insertedPositions} fatias e ${inserted.insertedRounds} rodadas inseridos. Dados locais mantidos.`,
          "success"
        );
        return;
      }

      const keys = [
        STORAGE_KEY,
        STORE_CONFIG_STORAGE_KEY,
        VENDORS_STORAGE_KEY,
        ROUNDS_STORAGE_KEY,
        SPIN_LOCK_STORAGE_KEY,
        BACKUP_META_STORAGE_KEY
      ];
      const previousValues = new Map(keys.map((key) => [key, window.localStorage.getItem(key)]));
      const backupTimestamp = new Date().toISOString();
      try {
        if (imported.legacyConfiguration) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(imported.legacyConfiguration));
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
        window.localStorage.setItem(STORE_CONFIG_STORAGE_KEY, JSON.stringify({
          version: 1,
          stores: imported.storeConfigurations
        }));
        window.localStorage.setItem(VENDORS_STORAGE_KEY, JSON.stringify({
          version: 1,
          items: imported.vendors
        }));
        window.localStorage.setItem(ROUNDS_STORAGE_KEY, JSON.stringify({
          version: 1,
          items: imported.rounds
        }));
        window.localStorage.removeItem(SPIN_LOCK_STORAGE_KEY);
        window.localStorage.setItem(BACKUP_META_STORAGE_KEY, backupTimestamp);
      } catch (writeError) {
        const rollbackErrors = [];
        for (const [key, value] of previousValues) {
          try {
            if (value === null) window.localStorage.removeItem(key);
            else window.localStorage.setItem(key, value);
          } catch (rollbackError) {
            rollbackErrors.push(rollbackError.message);
          }
        }
        const detail = rollbackErrors.length ? ` A restauração parcial também falhou: ${rollbackErrors.join("; ")}` : "";
        throw new Error(`Não foi possível gravar o backup: ${writeError.message}.${detail}`);
      }

      storeConfigurations = imported.storeConfigurations;
      vendors = imported.vendors;
      rounds = imported.rounds;
      if (releaseSpinLock) {
        releaseSpinLock();
        releaseSpinLock = null;
      }
      activeRoundId = activePendingRounds()[0]?.id || null;
      positions = storeConfigurations[spinStore.value] || storeConfigurations[selectedPrizeStoreId];
      draftPositions = storeConfigurations[selectedPrizeStoreId].map((position) => ({ ...position }));
      draftGroups = groupPositions(draftPositions);
      refreshManagement();
      renderPrizeRows();
      drawWheel();
      updateBackupStatus(backupTimestamp);
      setManagementFeedback(backupFeedback, "Backup validado e importado. Vendedores, roletas e histórico foram restaurados.", "success");
    } catch (error) {
      setManagementFeedback(backupFeedback, `Importação do backup não realizada: ${error.message}`, "error");
    } finally {
      importBackupInput.value = "";
    }
  }

  function groupPositions(source) {
    const groups = [];
    const grouped = new Map();

    for (const position of source) {
      const key = JSON.stringify([position.name, position.cost, position.color]);
      let group = grouped.get(key);
      if (!group) {
        group = {
          id: createId(),
          name: position.name,
          quantity: 0,
          cost: position.cost,
          color: position.color,
          positionIds: []
        };
        grouped.set(key, group);
        groups.push(group);
      }
      group.quantity += 1;
      group.positionIds.push(position.id);
    }

    return groups;
  }

  function rebuildDraftPositions() {
    const nextPositions = [];
    for (const group of draftGroups) {
      const quantity = Number.isInteger(group.quantity) && group.quantity > 0 ? group.quantity : 0;
      const nextIds = [];
      for (let index = 0; index < quantity; index += 1) {
        const id = group.positionIds[index] || createId();
        nextIds.push(id);
        nextPositions.push({
          id,
          name: group.name,
          cost: group.cost,
          color: group.color
        });
      }
      group.positionIds = nextIds;
    }
    draftPositions = nextPositions;
  }

  function renderSlicePreview() {
    slicePreview.replaceChildren();
    positions.forEach((position, index) => {
      const draftPosition = draftPositions[index] || position;
      const label = document.createElement("label");
      label.className = "slice-preview__item";
      label.style.setProperty("--slice-color", draftPosition.color);
      label.title = `${String(index + 1).padStart(2, "0")} • ${draftPosition.name}`;
      const number = document.createElement("span");
      number.textContent = String(index + 1).padStart(2, "0");
      const color = document.createElement("input");
      color.type = "color";
      color.value = /^#[0-9a-fA-F]{6}$/.test(draftPosition.color) ? draftPosition.color : "#173451";
      color.dataset.sliceColor = String(index);
      color.setAttribute("aria-label", `Cor individual da fatia ${index + 1}`);
      label.append(number, color);
      slicePreview.append(label);
    });
  }

  function resizeWheel() {
    const bounds = wheelCanvas.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    const size = Math.round(bounds.width * pixelRatio);
    if (!size) return;

    wheelCanvas.width = size;
    wheelCanvas.height = size;
    wheelContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawWheel();
  }

  function wrapWheelLabel(context, text, maxWidth) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) {
        lines.push(line);
        line = "";
      }
      if (context.measureText(word).width <= maxWidth) {
        line = word;
        continue;
      }

      let part = "";
      for (const character of Array.from(word)) {
        if (part && context.measureText(`${part}${character}`).width > maxWidth) {
          lines.push(`${part}-`);
          part = character;
        } else {
          part += character;
        }
      }
      line = part;
    }

    if (line) lines.push(line);
    return lines.length ? lines : [text];
  }

  function wheelLabelLayout(name, radius, labelRadius, sliceAngle) {
    const cacheKey = `${radius}|${name}`;
    const cached = wheelLabelLayoutCache.get(cacheKey);
    if (cached) return cached;

    const maxWidth = radius * 0.52;
    const maxHeight = 2 * labelRadius * Math.sin(sliceAngle / 2) * 0.84;
    const smallestFont = Math.max(4.5, Math.min(5.5, radius * 0.04));
    const largestFont = Math.min(12, Math.max(smallestFont, radius * 0.042));
    let selected = null;

    for (let fontSize = largestFont; fontSize >= smallestFont; fontSize -= 0.5) {
      wheelContext.font = `700 ${fontSize}px "DM Sans", sans-serif`;
      const lines = wrapWheelLabel(wheelContext, name, maxWidth);
      const lineHeight = fontSize * 1.04;
      if (lines.length * lineHeight <= maxHeight) {
        selected = { lines, fontSize, lineHeight };
        break;
      }
    }

    if (!selected) {
      const fontSize = smallestFont;
      wheelContext.font = `700 ${fontSize}px "DM Sans", sans-serif`;
      const lineHeight = fontSize * 1.04;
      const wrappedLines = wrapWheelLabel(wheelContext, name, maxWidth);
      const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
      const lines = wrappedLines.slice(0, maxLines);
      if (wrappedLines.length > maxLines) {
        lines[maxLines - 1] = maxLines === 1
          ? `${lines[0].slice(0, -1)}…`
          : `…${wrappedLines[wrappedLines.length - 1]}`;
      }
      selected = {
        lines,
        fontSize,
        lineHeight
      };
    }

    if (wheelLabelLayoutCache.size > 200) wheelLabelLayoutCache.clear();
    wheelLabelLayoutCache.set(cacheKey, selected);
    return selected;
  }

  function contrastTextColor(hexColor) {
    const channels = hexColor.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
    const luminance = channels
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const whiteContrast = 1.05 / (luminance + 0.05);
    const darkContrast = (luminance + 0.05) / (0.015 + 0.05);
    return whiteContrast >= darkContrast ? "#ffffff" : "#102033";
  }

  function drawWheel() {
    const { width, height } = wheelCanvas.getBoundingClientRect();
    if (!width || !height) return;
    if (remoteMode && !remoteReady) {
      wheelContext.clearRect(0, 0, width, height);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2;
    const sliceAngle = FULL_TURN / SEGMENT_COUNT;

    wheelContext.clearRect(0, 0, width, height);
    wheelContext.save();
    wheelContext.translate(centerX, centerY);

    for (let index = 0; index < SEGMENT_COUNT; index += 1) {
      const startAngle = rotation + index * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      wheelContext.beginPath();
      wheelContext.moveTo(0, 0);
      wheelContext.arc(0, 0, radius, startAngle, endAngle);
      wheelContext.closePath();
      wheelContext.fillStyle = positions[index].color || COLORS[index % COLORS.length];
      wheelContext.fill();
      wheelContext.lineWidth = Math.max(1, radius * 0.006);
      wheelContext.strokeStyle = "rgba(255, 235, 190, 0.72)";
      wheelContext.stroke();

      if (index === highlightedIndex) {
        wheelContext.save();
        wheelContext.beginPath();
        wheelContext.moveTo(0, 0);
        wheelContext.arc(0, 0, radius * 0.985, startAngle, endAngle);
        wheelContext.closePath();
        wheelContext.lineWidth = Math.max(2, radius * 0.018);
        wheelContext.strokeStyle = "#fff0bc";
        wheelContext.shadowColor = "#ffe09a";
        wheelContext.shadowBlur = 12;
        wheelContext.stroke();
        wheelContext.restore();
      }

      const middleAngle = startAngle + sliceAngle / 2;
      wheelContext.save();
      wheelContext.rotate(middleAngle);
      const labelRadius = radius * 0.73;
      wheelContext.translate(labelRadius, 0);
      if (normalizeAngle(middleAngle) > Math.PI / 2 && normalizeAngle(middleAngle) < Math.PI * 1.5) {
        wheelContext.rotate(Math.PI);
      }
      const label = wheelLabelLayout(positions[index].name, radius, labelRadius, sliceAngle);
      wheelContext.fillStyle = contrastTextColor(positions[index].color || COLORS[index % COLORS.length]);
      wheelContext.strokeStyle = wheelContext.fillStyle === "#ffffff"
        ? "rgba(5, 15, 28, 0.58)"
        : "rgba(255, 255, 255, 0.42)";
      wheelContext.lineWidth = Math.max(0.65, label.fontSize * 0.12);
      wheelContext.textAlign = "center";
      wheelContext.textBaseline = "middle";
      wheelContext.font = `700 ${label.fontSize}px "DM Sans", sans-serif`;
      wheelContext.shadowColor = "rgba(0, 0, 0, 0.3)";
      wheelContext.shadowBlur = 1;
      label.lines.forEach((line, lineIndex) => {
        const lineY = (lineIndex - (label.lines.length - 1) / 2) * label.lineHeight;
        wheelContext.strokeText(line, 0, lineY, radius * 0.52);
        wheelContext.fillText(line, 0, lineY, radius * 0.52);
      });
      wheelContext.restore();
    }

    wheelContext.restore();
  }

  function winningIndexAtPointer(currentRotation) {
    const angleAtPointer = normalizeAngle(POINTER_ANGLE - currentRotation);
    return Math.floor(angleAtPointer / (FULL_TURN / SEGMENT_COUNT)) % SEGMENT_COUNT;
  }

  function prepareAudioForGesture() {
    if (!soundEnabled) return Promise.resolve(false);
    try {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextConstructor) return Promise.resolve(false);
      if (!audioContext) {
        audioContext = new AudioContextConstructor();
        audioMasterGain = audioContext.createGain();
        audioMasterGain.gain.value = 0.38;
        audioMasterGain.connect(audioContext.destination);
        const noiseLength = Math.ceil(audioContext.sampleRate * 0.035);
        wheelTickNoiseBuffer = audioContext.createBuffer(1, noiseLength, audioContext.sampleRate);
        const noiseSamples = wheelTickNoiseBuffer.getChannelData(0);
        for (let index = 0; index < noiseSamples.length; index += 1) {
          noiseSamples[index] = Math.random() * 2 - 1;
        }
      }
      const ready = audioContext.state === "running"
        ? Promise.resolve()
        : audioContext.resume();
      return ready.then(() => audioContext.state === "running").catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  function playTone(
    frequency,
    endFrequency,
    duration,
    volume,
    startAt,
    belongsToSpin = false,
    waveform = "triangle"
  ) {
    if (!soundEnabled || !audioContext || audioContext.state !== "running" || !audioMasterGain) return;
    try {
      const start = Math.max(audioContext.currentTime, startAt ?? audioContext.currentTime);
      const end = start + duration;
      const oscillator = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), end);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.004, duration / 3));
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(envelope);
      envelope.connect(audioMasterGain);
      activeAudioNodes.set(oscillator, belongsToSpin);
      oscillator.addEventListener("ended", () => {
        activeAudioNodes.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      }, { once: true });
      oscillator.start(start);
      oscillator.stop(end + 0.005);
    } catch {
      return;
    }
  }

  function playWheelTick(progress, startAt, belongsToSpin = true) {
    if (!soundEnabled || !audioContext || audioContext.state !== "running" ||
        !audioMasterGain || !wheelTickNoiseBuffer) return;
    try {
      const start = Math.max(audioContext.currentTime, startAt ?? audioContext.currentTime);
      const source = audioContext.createBufferSource();
      const filter = audioContext.createBiquadFilter();
      const envelope = audioContext.createGain();
      source.buffer = wheelTickNoiseBuffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1250 - progress * 450, start);
      filter.Q.value = 0.55;
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(0.085 - progress * 0.035, start + 0.002);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.027);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(audioMasterGain);
      activeAudioNodes.set(source, belongsToSpin);
      source.addEventListener("ended", () => {
        activeAudioNodes.delete(source);
        source.disconnect();
        filter.disconnect();
        envelope.disconnect();
      }, { once: true });
      source.start(start);
      source.stop(start + 0.03);
    } catch {
      return;
    }
  }

  function stopSpinAudio() {
    spinSoundActive = false;
    for (const [oscillator, belongsToSpin] of activeAudioNodes) {
      if (!belongsToSpin) continue;
      activeAudioNodes.delete(oscillator);
      try {
        oscillator.stop();
      } catch {
        continue;
      }
    }
  }

  function stopAllAudio() {
    spinSoundActive = false;
    for (const timer of audioPreviewTimers.splice(0)) {
      window.clearTimeout(timer);
    }
    for (const oscillator of activeAudioNodes.keys()) {
      activeAudioNodes.delete(oscillator);
      try {
        oscillator.stop();
      } catch {
        continue;
      }
    }
  }

  function playVictorySound() {
    if (!soundEnabled || !audioContext || audioContext.state !== "running") return;
    const now = audioContext.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((note, index) => {
      playTone(note, note * 1.025, 0.2, 0.065, now + index * 0.12, false, "sine");
    });
  }

  function updateSoundToggle() {
    soundToggle.classList.toggle("is-muted", !soundEnabled);
    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    const label = soundEnabled ? "Desativar som" : "Ativar som";
    soundToggle.setAttribute("aria-label", label);
    soundToggle.title = label;
    for (const button of soundTestPanel.querySelectorAll("button")) {
      button.disabled = !soundEnabled;
    }
    if (!soundEnabled) {
      soundTestFeedback.textContent = "Ative o som para ouvir os testes.";
    } else if (soundTestFeedback.textContent === "Ative o som para ouvir os testes.") {
      soundTestFeedback.textContent = "";
    }
  }

  async function previewSound(effect) {
    if (!soundEnabled) {
      soundTestFeedback.textContent = "Ative o som para ouvir os testes.";
      return;
    }
    stopAllAudio();
    const ready = await prepareAudioForGesture();
    if (!ready) {
      soundTestFeedback.textContent = "O áudio não está disponível neste navegador.";
      return;
    }
    soundTestFeedback.textContent = "";
    if (effect === "tick") {
      [0, 0.12, 0.27, 0.45, 0.66].forEach((delay, index) => {
        const timer = window.setTimeout(() => {
          const timerIndex = audioPreviewTimers.indexOf(timer);
          if (timerIndex >= 0) audioPreviewTimers.splice(timerIndex, 1);
          if (soundEnabled) playWheelTick(index / 4, audioContext.currentTime, false);
        }, delay * 1000);
        audioPreviewTimers.push(timer);
      });
    } else if (effect === "victory") {
      playVictorySound();
    }
  }

  async function spin() {
    if (isSpinning || (remoteMode ? !remoteReady : activePendingRounds().length > 0)) return;
    const selectedStore = STORES.find((store) => store.id === spinStore.value);
    const selectedVendor = vendors.find((vendor) =>
      vendor.active && vendor.id === spinSeller.value && vendor.storeId === spinStore.value
    );
    if (!selectedStore || !selectedVendor) {
      updateSpinAvailability();
      return;
    }

    const audioReady = prepareAudioForGesture();
    positions = storeConfigurations[selectedStore.id];
    isSpinning = true;
    const spinContext = {
      storeId: selectedStore.id,
      storeName: selectedStore.name,
      sellerId: selectedVendor.id,
      sellerName: selectedVendor.name
    };
    updateSpinAvailability();

    function animateWithLock(serverRound = null, audioAvailable = false) {
      buttonLabel.textContent = "BOA SORTE!";
      prizeCard.classList.remove("is-winner");
      resultLabel.textContent = "A ROLETA ESTÁ GIRANDO";
      resultValue.textContent = "Segure a emoção ✦";
      resultMeta.textContent = "";

      const selectedIndex = serverRound ? serverRound.positionIndex : Math.floor(Math.random() * SEGMENT_COUNT);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= SEGMENT_COUNT) {
        isSpinning = false;
        stopSpinAudio();
        updateSpinAvailability();
        spinBlockMessage.textContent = "O servidor retornou uma fatia inválida. Tente novamente.";
        return;
      }
      const sliceAngle = FULL_TURN / SEGMENT_COUNT;
      const desiredRotation = POINTER_ANGLE - (selectedIndex + 0.5) * sliceAngle;
      const remainingAngle = normalizeAngle(desiredRotation - normalizeAngle(rotation));
      const extraTurns = 6 + Math.floor(Math.random() * 5);
      const startRotation = rotation;
      const endRotation = rotation + extraTurns * FULL_TURN + remainingAngle;
      const duration = reducedMotion.matches ? 1000 : 5000 + Math.random() * 3000;
      const startTime = performance.now();
      let previousFrameTime = startTime;
      let lastSoundPosition = Math.floor(startRotation / sliceAngle);
      highlightedIndex = -1;

      spinSoundActive = audioAvailable;

      function animate(now) {
        try {
          const progress = Math.min((now - startTime) / duration, 1);
          const easedProgress = 1 - Math.pow(1 - progress, 4);
          const previousRotation = rotation;
          rotation = startRotation + (endRotation - startRotation) * easedProgress;
          if (spinSoundActive && rotation > previousRotation) {
            const currentSoundPosition = Math.floor(rotation / sliceAngle);
            const frameDuration = (now - previousFrameTime) / 1000;
            for (let position = lastSoundPosition + 1; position <= currentSoundPosition; position += 1) {
              const crossingFraction = (position * sliceAngle - previousRotation) / (rotation - previousRotation);
              const tickTime = audioContext.currentTime + Math.max(0, frameDuration * crossingFraction);
              playWheelTick(progress, tickTime);
            }
            lastSoundPosition = currentSoundPosition;
          }
          previousFrameTime = now;
          drawWheel();

          if (progress < 1) {
            spinAnimationFrame = requestAnimationFrame(animate);
            return;
          }

          spinAnimationFrame = 0;
          rotation = normalizeAngle(endRotation);
          const actualIndex = winningIndexAtPointer(rotation);
          highlightedIndex = actualIndex;
          drawWheel();
          const prize = positions[actualIndex];
          const round = {
            id: serverRound?.id || createId(),
            date: serverRound?.date || new Date().toISOString(),
            ...spinContext,
            prizeId: serverRound?.prizeId || prize.id,
            prizeName: serverRound?.prizeName || prize.name,
            estimatedCost: serverRound?.estimatedCost ?? prize.cost,
            positionIndex: actualIndex,
            delivered: serverRound?.delivered ?? false,
            deliveredAt: serverRound?.deliveredAt ?? null
          };
          rounds = [round, ...rounds];
          activeRoundId = round.id;
          let persistenceError = null;
          let roundSaved = false;
          if (!remoteMode) {
            try {
              rounds = persistCollection(ROUNDS_STORAGE_KEY, rounds, validateRounds);
              roundSaved = true;
            } catch (error) {
              persistenceError = error;
            }
            if (roundSaved) {
              try {
                extendStoredSpinLock(round.id);
              } catch (error) {
                persistenceError = persistenceError || error;
              }
            }
          }
          showResult(actualIndex, round, persistenceError);
        } catch (error) {
          spinAnimationFrame = 0;
          stopSpinAudio();
          isSpinning = false;
          buttonLabel.textContent = "GIRAR ROLETA";
          updateSpinAvailability();
          spinBlockMessage.textContent = `A animação foi interrompida: ${error.message}`;
        }
      }

      spinAnimationFrame = requestAnimationFrame(animate);
    }

    if (remoteMode) {
      try {
        pendingSpinRequest ||= {
          id: createIdempotencyKey(),
          storeId: selectedStore.id,
          sellerId: selectedVendor.id
        };
        window.sessionStorage.setItem(PENDING_SPIN_SESSION_KEY, JSON.stringify(pendingSpinRequest));
        const serverRound = await supabaseBackend.recordPublicSpin(
          pendingSpinRequest.storeId,
          pendingSpinRequest.sellerId,
          pendingSpinRequest.id
        );
        if (!Array.isArray(serverRound.positions) ||
            serverRound.positions.some((position, index) => position.index !== index)) {
          throw new Error("O servidor retornou uma configuração de fatias inválida.");
        }
        const spinPositions = validatePositions(serverRound.positions);
        const serverPosition = spinPositions[serverRound.positionIndex];
        if (!Number.isInteger(serverRound.positionIndex) ||
            serverRound.positionIndex < 0 ||
            serverRound.positionIndex >= SEGMENT_COUNT ||
            spinPositions.length !== SEGMENT_COUNT || !serverPosition ||
            serverPosition.id !== serverRound.prizeId ||
            serverPosition.name !== serverRound.prizeName ||
            Number(serverPosition.cost) !== Number(serverRound.estimatedCost)) {
          throw new Error("O servidor retornou um resultado incompatível com a configuração da roleta.");
        }
        storeConfigurations[selectedStore.id] = spinPositions;
        positions = spinPositions;
        drawWheel();
        pendingSpinRequest = null;
        animateWithLock(serverRound, await audioReady);
      } catch (error) {
        isSpinning = false;
        stopSpinAudio();
        buttonLabel.textContent = "GIRAR ROLETA";
        updateSpinAvailability();
        spinBlockMessage.textContent = `Não foi possível registrar o giro online: ${error.message}. Tente novamente; a mesma solicitação será reutilizada.`;
      }
      return;
    }

    const roundId = createId();
    acquireSpinLock(roundId).then(async (acquired) => {
      if (!acquired) {
        isSpinning = false;
        stopSpinAudio();
        updateSpinAvailability();
        spinBlockMessage.textContent = "Outra aba já está usando a roleta. Aguarde a confirmação da entrega.";
        return;
      }
      animateWithLock(null, await audioReady);
    }).catch((error) => {
      isSpinning = false;
      stopSpinAudio();
      updateSpinAvailability();
      spinBlockMessage.textContent = `Não foi possível bloquear a roleta: ${error.message}`;
    });
  }

  function showResult(index, round, persistenceError = null) {
    isSpinning = false;
    stopSpinAudio();
    playVictorySound();
    if (remoteMode) {
      window.sessionStorage.removeItem(PENDING_SPIN_SESSION_KEY);
      pendingSpinRequest = null;
      spinSeller.value = "";
    }
    buttonLabel.textContent = "GIRAR ROLETA";
    resultLabel.textContent = `FATIA ${String(index + 1).padStart(2, "0")} • PARABÉNS!`;
    resultValue.textContent = round.prizeName;
    resultMeta.textContent = `${formatCurrency(round.estimatedCost)} • ${round.sellerName} — ${round.storeName}`;
    prizeCard.classList.add("is-winner");
    updateSpinAvailability();
    if (persistenceError) {
      spinBlockMessage.textContent = `A rodada ${round.id} teve um problema ao salvar os dados: ${persistenceError.message}. Confirme a entrega para tentar novamente.`;
    }
    renderHistory();
    launchConfetti();
    if (remoteMode && remoteRefreshRequested) {
      refreshSupabaseData().catch((error) => {
        spinBlockMessage.textContent = `Não foi possível sincronizar os dados: ${error.message}`;
      });
    }
  }

  function resizeConfettiCanvas() {
    const pixelRatio = window.devicePixelRatio || 1;
    confettiCanvas.width = Math.round(window.innerWidth * pixelRatio);
    confettiCanvas.height = Math.round(window.innerHeight * pixelRatio);
    confettiContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function launchConfetti() {
    cancelAnimationFrame(confettiFrame);
    resizeConfettiCanvas();

    const colors = ["#f5c86a", "#fff0bc", "#e36b5d", "#64c4ab", "#8ba8e8", "#cf83bd"];
    const pieces = Array.from({ length: 150 }, () => ({
      x: Math.random() * window.innerWidth,
      y: -Math.random() * window.innerHeight * 0.65,
      size: 4 + Math.random() * 6,
      speed: 2.2 + Math.random() * 4.2,
      drift: (Math.random() - 0.5) * 2.5,
      rotation: Math.random() * FULL_TURN,
      spin: (Math.random() - 0.5) * 0.16,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    const startedAt = performance.now();

    function animateConfetti(now) {
      const elapsed = now - startedAt;
      confettiContext.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const piece of pieces) {
        piece.x += piece.drift;
        piece.y += piece.speed;
        piece.rotation += piece.spin;
        confettiContext.save();
        confettiContext.translate(piece.x, piece.y);
        confettiContext.rotate(piece.rotation);
        confettiContext.fillStyle = piece.color;
        confettiContext.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.62);
        confettiContext.restore();
      }

      if (elapsed < 3600 && pieces.some((piece) => piece.y < window.innerHeight + 20)) {
        confettiFrame = requestAnimationFrame(animateConfetti);
      } else {
        confettiContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }

    confettiFrame = requestAnimationFrame(animateConfetti);
  }

  function createField(label, field, value, type, attributes = {}) {
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.type = type;
    input.value = String(value);
    input.dataset.field = field;
    input.setAttribute("aria-label", label);
    for (const [name, attributeValue] of Object.entries(attributes)) {
      input.setAttribute(name, String(attributeValue));
    }
    cell.append(input);
    return cell;
  }

  function renderPrizeRows() {
    prizeRows.replaceChildren();

    for (const group of draftGroups) {
      const row = document.createElement("tr");
      row.dataset.groupId = group.id;

      row.append(createField("Nome do prêmio", "name", group.name, "text", {
        maxlength: 80,
        required: true,
        placeholder: "Nome do prêmio"
      }));
      row.append(createField("Quantidade de posições", "quantity", group.quantity, "number", {
        min: 0,
        max: SEGMENT_COUNT,
        step: 1,
        required: true,
        inputmode: "numeric"
      }));
      row.append(createField("Custo estimado por unidade em reais", "cost", group.cost, "number", {
        min: 0,
        max: 1000000,
        step: "0.01",
        required: true,
        inputmode: "decimal"
      }));
      row.append(createField("Cor das fatias", "color", group.color, "color"));

      const actionCell = document.createElement("td");
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "admin__remove";
      removeButton.dataset.removeGroup = group.id;
      removeButton.textContent = "REMOVER";
      removeButton.setAttribute("aria-label", `Remover ${group.name}`);
      actionCell.append(removeButton);
      row.append(actionCell);
      prizeRows.append(row);
    }

    updateDraftSummary();
    renderSlicePreview();
  }

  function updateDraftSummary() {
    const quantities = draftGroups.map((group) => group.quantity);
    const validQuantities = quantities.every((quantity) =>
      Number.isInteger(quantity) && quantity >= 0 && quantity <= SEGMENT_COUNT
    );
    const count = validQuantities ? quantities.reduce((sum, quantity) => sum + quantity, 0) : NaN;
    const validGroups = draftGroups.length > 0 && draftGroups.every((group) =>
      typeof group.name === "string" &&
      group.name.trim().length > 0 &&
      group.name.trim().length <= 80 &&
      Number.isFinite(group.cost) &&
      group.cost >= 0 &&
      group.cost <= 1000000 &&
      /^#[0-9a-fA-F]{6}$/.test(group.color)
    );
    const total = validQuantities && validGroups
      ? draftGroups.reduce((sum, group) => sum + group.quantity * group.cost, 0)
      : NaN;

    positionCount.textContent = `${Number.isFinite(count) ? count : "—"} / ${SEGMENT_COUNT}`;
    positionCount.classList.toggle("is-invalid", count !== SEGMENT_COUNT);
    totalCost.textContent = Number.isFinite(total) ? formatCurrency(total) : "—";
    averageCost.textContent = Number.isFinite(total) && count === SEGMENT_COUNT
      ? formatCurrency(total / SEGMENT_COUNT)
      : "—";
    saveButton.disabled = count !== SEGMENT_COUNT || !validGroups;

    if (Number.isFinite(count) && count !== SEGMENT_COUNT) {
      setFeedback(`A soma das quantidades precisa ser exatamente ${SEGMENT_COUNT}. No momento: ${count}.`, "error");
    } else if (!validGroups || !validQuantities) {
      setFeedback("Verifique os nomes, quantidades, custos e cores informados.", "error");
    } else if (count === SEGMENT_COUNT) {
      setFeedback("Configuração válida. Salve para aplicar os prêmios à roleta.", "success");
    }
  }

  function setFeedback(message, kind = "") {
    adminFeedback.textContent = message;
    adminFeedback.className = `admin-feedback${kind ? ` admin-feedback--${kind}` : ""}`;
  }

  function openAdmin() {
    if (isSpinning) return;
    positions = storeConfigurations[selectedPrizeStoreId];
    draftGroups = groupPositions(positions);
    draftPositions = positions.map((position) => ({ ...position }));
    renderPrizeRows();
    if (startupMessage) {
      setFeedback(startupMessage, "error");
      startupMessage = "";
    }
    introSection.hidden = true;
    gameSection.hidden = true;
    adminPanel.hidden = false;
    openAdminButton.setAttribute("aria-expanded", "true");
    window.scrollTo(0, 0);
  }

  function closeAdmin() {
    adminPanel.hidden = true;
    introSection.hidden = false;
    gameSection.hidden = false;
    openAdminButton.setAttribute("aria-expanded", "false");
    positions = storeConfigurations[spinStore.value] || storeConfigurations[selectedPrizeStoreId];
    drawWheel();
  }

  async function signOutManager() {
    try {
      window.sessionStorage.removeItem(MANAGER_SESSION_KEY);
      if (remoteMode) {
        const { error } = await supabaseBackend.client.auth.signOut();
        if (error) throw error;
      }
      window.top.location.assign("index.html");
    } catch (error) {
      setManagementFeedback(adminFeedback, `Não foi possível encerrar a sessão: ${error.message}`, "error");
    }
  }

  function switchAdminTab(tabName) {
    vendorPane.hidden = tabName !== "vendors";
    prizePane.hidden = tabName !== "prizes";
    historyPane.hidden = tabName !== "history";
    for (const button of document.querySelectorAll("[data-admin-tab]")) {
      const selected = button.dataset.adminTab === tabName;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    }

    const headings = {
      vendors: ["Vendedores.", "Cadastre, pesquise, transfira e gerencie o status dos vendedores por concessionária."],
      prizes: ["Gestão da Roleta.", "Cada concessionária tem seus próprios 40 prêmios e custos estimados."],
      history: ["Histórico de premiações.", "Consulte e exporte os giros registrados, com entrega e custo estimado."]
    };
    document.querySelector("#admin-title").textContent = headings[tabName][0];
    document.querySelector(".admin__heading .intro__copy").textContent = headings[tabName][1];
    if (tabName === "vendors") {
      refreshManagement();
    } else if (tabName === "history") {
      renderHistory();
    } else if (tabName === "prizes") {
      draftPositions = storeConfigurations[selectedPrizeStoreId].map((position) => ({ ...position }));
      draftGroups = groupPositions(draftPositions);
      renderPrizeRows();
    }
  }

  function showVendorForm(vendor = null) {
    vendorForm.hidden = false;
    if (vendor) {
      editingVendorId = vendor.id;
      vendorNameInput.value = vendor.name;
      vendorStoreInput.value = vendor.storeId;
      vendorSubmit.textContent = "SALVAR ALTERAÇÕES";
      vendorCancel.textContent = "CANCELAR EDIÇÃO";
    } else {
      editingVendorId = null;
      vendorForm.reset();
      vendorStoreInput.value = vendorStoreFilter.value || STORES[0].id;
      vendorSubmit.textContent = "SALVAR VENDEDOR";
      vendorCancel.textContent = "CANCELAR";
    }
    vendorNameInput.focus();
  }

  function hideVendorForm() {
    editingVendorId = null;
    vendorForm.reset();
    vendorForm.hidden = true;
    vendorStoreInput.value = STORES[0].id;
    vendorSubmit.textContent = "SALVAR VENDEDOR";
  }

  function addPrizeGroup() {
    draftGroups.push({
      id: createId(),
      name: "",
      quantity: 0,
      cost: 0,
      color: COLORS[draftGroups.length % COLORS.length],
      positionIds: []
    });
    renderPrizeRows();
    const nameInput = prizeRows.querySelector(`tr[data-group-id="${draftGroups[draftGroups.length - 1].id}"] input[data-field="name"]`);
    nameInput.focus();
  }

  function updateGroupField(event) {
    const input = event.target;
    const field = input.dataset.field;
    if (!field) return;

    const row = input.closest("tr");
    const group = draftGroups.find((entry) => entry.id === row.dataset.groupId);
    if (!group) return;

    if (field === "quantity") {
      group.quantity = input.value === "" ? NaN : Number(input.value);
      rebuildDraftPositions();
    } else if (field === "cost") {
      group.cost = input.value === "" ? NaN : Number(input.value);
      for (const id of group.positionIds) {
        const position = draftPositions.find((entry) => entry.id === id);
        if (position) position.cost = group.cost;
      }
    } else {
      group[field] = input.value;
      for (const id of group.positionIds) {
        const position = draftPositions.find((entry) => entry.id === id);
        if (position) position[field] = group[field];
      }
    }
    updateDraftSummary();
    renderSlicePreview();
  }

  async function saveDraft() {
    const count = draftGroups.reduce((sum, group) => sum + group.quantity, 0);
    if (count !== SEGMENT_COUNT || saveButton.disabled) {
      setFeedback(`A configuração só pode ser salva com exatamente ${SEGMENT_COUNT} posições e dados válidos.`, "error");
      return;
    }

    saveButton.disabled = true;
    try {
      const nextPositions = validatePositions(draftPositions.map((position) => ({
        ...position,
        name: position.name.trim()
      })));
      if (remoteMode) {
        await supabaseBackend.saveStorePositions(selectedPrizeStoreId, nextPositions);
        remoteConfiguredStoreIds.add(selectedPrizeStoreId);
        storeConfigurations = {
          ...storeConfigurations,
          [selectedPrizeStoreId]: nextPositions
        };
        positions = storeConfigurations[spinStore.value] || storeConfigurations[selectedPrizeStoreId];
      } else {
        saveCurrentStorePositions(nextPositions);
      }
      highlightedIndex = -1;
      renderPrizeRows();
      refreshSpinSelectors();
      if (spinStore.value === selectedPrizeStoreId) drawWheel();
      setFeedback(remoteMode
        ? `Roleta da ${storeName(selectedPrizeStoreId)} sincronizada com o banco online.`
        : `Roleta da ${storeName(selectedPrizeStoreId)} salva neste navegador.`, "success");
    } catch (error) {
      setFeedback(`Não foi possível salvar a configuração: ${error.message}`, "error");
    } finally {
      updateDraftSummary();
    }
  }

  function exportConfig() {
    const json = JSON.stringify({
      version: 1,
      storeId: selectedPrizeStoreId,
      positions: storeConfigurations[selectedPrizeStoreId]
    }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "roleta-jorlan-config.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("Configuração atual exportada em JSON.", "success");
  }

  async function importConfig() {
    const file = importInput.files[0];
    if (!file) return;

    try {
      if (file.size > 1024 * 1024) {
        throw new Error("O arquivo deve ter no máximo 1 MB.");
      }
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.version !== 1) {
        throw new Error("JSON inválido: informe version 1 e a lista positions.");
      }
      const importedPositions = validatePositions(parsed.positions);
      if (remoteMode) {
        await supabaseBackend.saveStorePositions(selectedPrizeStoreId, importedPositions);
        remoteConfiguredStoreIds.add(selectedPrizeStoreId);
        storeConfigurations = {
          ...storeConfigurations,
          [selectedPrizeStoreId]: importedPositions
        };
        positions = storeConfigurations[spinStore.value] || importedPositions;
      } else {
        saveCurrentStorePositions(importedPositions);
      }
      draftPositions = storeConfigurations[selectedPrizeStoreId].map((position) => ({ ...position }));
      draftGroups = groupPositions(draftPositions);
      renderPrizeRows();
      highlightedIndex = -1;
      if (spinStore.value === selectedPrizeStoreId) drawWheel();
      setFeedback("JSON validado e importado. A roleta já está atualizada.", "success");
    } catch (error) {
      setFeedback(`Importação não realizada: ${error.message}`, "error");
    } finally {
      importInput.value = "";
    }
  }

  async function restoreDefaultStoreConfig() {
    if (!window.confirm(`Restaurar a configuração padrão da roleta de ${storeName(selectedPrizeStoreId)}?`)) return;
    const defaultPositions = createDefaultPositions();
    try {
      if (remoteMode) {
        await supabaseBackend.saveStorePositions(selectedPrizeStoreId, defaultPositions);
        remoteConfiguredStoreIds.add(selectedPrizeStoreId);
        storeConfigurations = {
          ...storeConfigurations,
          [selectedPrizeStoreId]: defaultPositions
        };
        positions = storeConfigurations[spinStore.value] || defaultPositions;
      } else {
        saveCurrentStorePositions(defaultPositions);
      }
      draftPositions = storeConfigurations[selectedPrizeStoreId].map((position) => ({ ...position }));
      draftGroups = groupPositions(draftPositions);
      highlightedIndex = -1;
      refreshSpinSelectors();
      renderPrizeRows();
      if (spinStore.value === selectedPrizeStoreId) drawWheel();
      setFeedback(`Configuração padrão restaurada apenas para ${storeName(selectedPrizeStoreId)}.`, "success");
    } catch (error) {
      setFeedback(`Não foi possível restaurar o padrão: ${error.message}`, "error");
    }
  }

  function shuffleDraftColors() {
    if (draftPositions.length !== SEGMENT_COUNT) {
      setFeedback(`A roleta precisa ter exatamente ${SEGMENT_COUNT} posições para sortear as cores.`, "error");
      return;
    }

    draftPositions = randomizePositionColors(draftPositions);
    draftGroups = groupPositions(draftPositions);
    renderPrizeRows();
    setFeedback("Nova combinação de cores gerada. Salve a configuração para aplicá-la à roleta.", "success");
  }

  function changePrizeStore() {
    const nextStoreId = prizeStoreSelect.value;
    if (!storeConfigurations[nextStoreId]) return;
    const currentDraft = JSON.stringify(draftGroups.map(({ name, quantity, cost, color }) => ({ name, quantity, cost, color })));
    const savedDraft = JSON.stringify(groupPositions(storeConfigurations[selectedPrizeStoreId])
      .map(({ name, quantity, cost, color }) => ({ name, quantity, cost, color })));
    if (currentDraft !== savedDraft &&
        !window.confirm("Descartar as alterações não salvas desta concessionária?")) {
      prizeStoreSelect.value = selectedPrizeStoreId;
      return;
    }

    selectedPrizeStoreId = nextStoreId;
    draftPositions = storeConfigurations[selectedPrizeStoreId].map((position) => ({ ...position }));
    draftGroups = groupPositions(draftPositions);
    highlightedIndex = -1;
    renderPrizeRows();
  }

  function updateIndividualSliceColor(event) {
    const input = event.target;
    if (!input.matches("[data-slice-color]")) return;
    const index = Number(input.dataset.sliceColor);
    if (!Number.isInteger(index) || !draftPositions[index]) return;
    draftPositions[index].color = input.value;
    draftGroups = groupPositions(draftPositions);
    renderPrizeRows();
    setFeedback(`Cor da fatia ${String(index + 1).padStart(2, "0")} atualizada. Salve para aplicar.`, "success");
  }

  function handleStoreConfigUpdate() {
    const saved = window.localStorage.getItem(STORE_CONFIG_STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved);
    if (!parsed || parsed.version !== 1) throw new Error("A versão da configuração por loja não é compatível.");
    storeConfigurations = validateStoreConfigurations(parsed.stores);
    if (!isSpinning) {
      positions = storeConfigurations[spinStore.value] || storeConfigurations[selectedPrizeStoreId];
      drawWheel();
    }
    if (!prizePane.hidden && !isSpinning) {
      draftPositions = storeConfigurations[selectedPrizeStoreId].map((position) => ({ ...position }));
      draftGroups = groupPositions(draftPositions);
      renderPrizeRows();
    }
    updateSpinAvailability();
  }

  function handleSpinStoreChange() {
    if (storeConfigurations[spinStore.value]) {
      positions = storeConfigurations[spinStore.value];
      highlightedIndex = -1;
      drawWheel();
    }
    refreshSpinSelectors();
  }

  prizeRows.addEventListener("input", updateGroupField);
  prizeRows.addEventListener("change", updateGroupField);
  prizeRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-group]");
    if (!button) return;
    draftGroups = draftGroups.filter((group) => group.id !== button.dataset.removeGroup);
    renderPrizeRows();
  });
  slicePreview.addEventListener("change", updateIndividualSliceColor);
  spinButton.addEventListener("click", spin);
  soundToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    updateSoundToggle();
    if (soundEnabled) {
      prepareAudioForGesture();
    } else {
      stopAllAudio();
    }
  });
  soundTestPanel.addEventListener("click", (event) => {
    const testButton = event.target.closest("[data-sound-test]");
    if (testButton) previewSound(testButton.dataset.soundTest);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") stopSpinAudio();
  });
  window.addEventListener("pagehide", () => {
    if (spinAnimationFrame) cancelAnimationFrame(spinAnimationFrame);
    stopAllAudio();
  });
  spinStore.addEventListener("change", handleSpinStoreChange);
  spinSeller.addEventListener("change", updateSpinAvailability);
  confirmDeliveryButton.addEventListener("click", () => {
    const roundId = confirmDeliveryButton.dataset.roundId;
    if (roundId) confirmDelivery(roundId);
  });
  openAdminButton.addEventListener("click", () => {
    window.location.assign("login.html");
  });
  closeAdminButton.addEventListener("click", () => {
    if (isManagerPage) signOutManager();
    else closeAdmin();
  });
  exportBackupButton.addEventListener("click", exportFullBackup);
  importBackupButton.addEventListener("click", () => importBackupInput.click());
  importBackupInput.addEventListener("change", importFullBackup);
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => switchAdminTab(button.dataset.adminTab));
  });
  vendorForm.addEventListener("submit", saveVendor);
  showVendorFormButton.addEventListener("click", () => {
    showVendorForm();
    setManagementFeedback(vendorFeedback, "");
  });
  vendorCancel.addEventListener("click", () => {
    resetVendorForm();
    setManagementFeedback(vendorFeedback, "Formulário fechado.");
  });
  vendorStoreFilter.addEventListener("change", renderVendorRows);
  vendorSearch.addEventListener("input", renderVendorRows);
  showInactiveVendors.addEventListener("change", renderVendorRows);
  vendorRows.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-vendor]");
    const toggleButton = event.target.closest("[data-toggle-vendor]");
    const deleteButton = event.target.closest("[data-delete-vendor]");
    if (editButton) startEditingVendor(editButton.dataset.editVendor);
    if (toggleButton) toggleVendor(toggleButton.dataset.toggleVendor);
    if (deleteButton) deleteVendor(deleteButton.dataset.deleteVendor);
  });
  historyStore.addEventListener("change", renderHistory);
  historySeller.addEventListener("change", renderHistory);
  historyFrom.addEventListener("change", renderHistory);
  historyTo.addEventListener("change", renderHistory);
  document.querySelector("#clear-history-filters").addEventListener("click", () => {
    historyStore.value = "";
    historySeller.value = "";
    historyFrom.value = "";
    historyTo.value = "";
    renderHistory();
  });
  document.querySelector("#export-history").addEventListener("click", exportHistoryCsv);
  prizeStoreSelect.addEventListener("change", changePrizeStore);
  historyRows.addEventListener("click", (event) => {
    const confirmButton = event.target.closest("[data-confirm-round]");
    if (confirmButton) confirmDelivery(confirmButton.dataset.confirmRound);
  });
  document.querySelector("#add-prize").addEventListener("click", addPrizeGroup);
  document.querySelector("#shuffle-colors").addEventListener("click", shuffleDraftColors);
  document.querySelector("#restore-config").addEventListener("click", restoreDefaultStoreConfig);
  saveButton.addEventListener("click", saveDraft);
  document.querySelector("#export-config").addEventListener("click", exportConfig);
  document.querySelector("#import-config-button").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", importConfig);
  window.addEventListener("storage", (event) => {
    if (remoteMode) return;
    try {
      if (event.key === VENDORS_STORAGE_KEY) {
        vendors = readStoredCollection(VENDORS_STORAGE_KEY, validateVendors, [], "os vendedores");
        renderVendorRows();
        refreshSpinSelectors();
      } else if (event.key === ROUNDS_STORAGE_KEY) {
        rounds = readStoredCollection(ROUNDS_STORAGE_KEY, validateRounds, [], "o histórico");
        if (releaseSpinLock && activeRoundId && rounds.some((round) => round.id === activeRoundId && round.delivered)) {
          releaseSpinLock();
          releaseSpinLock = null;
        }
        if (!activeRoundId || !rounds.some((round) => round.id === activeRoundId && !round.delivered)) {
          activeRoundId = activePendingRounds()[0]?.id || null;
        }
        renderHistory();
        renderVendorRows();
        updateSpinAvailability();
      } else if (event.key === STORE_CONFIG_STORAGE_KEY) {
        handleStoreConfigUpdate();
      } else if (event.key === SPIN_LOCK_STORAGE_KEY) {
        readSpinLock();
        updateSpinAvailability();
      } else if (event.key === BACKUP_META_STORAGE_KEY) {
        updateBackupStatus(event.newValue);
      } else {
        return;
      }
    } catch (error) {
      setManagementFeedback(historyFeedback, `Não foi possível atualizar os dados entre abas: ${error.message}`, "error");
    }
  });

  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeWheel();
      resizeConfettiCanvas();
    });
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resizeWheel).observe(wheelCanvas);
  }

  if (remoteMode) {
    vendors = [];
    rounds = [];
    populateStoreOptions(vendorStoreInput);
    vendorStoreInput.value = STORES[0].id;
    populateVendorStoreOptions();
    prizeStoreSelect.value = selectedPrizeStoreId;
    draftPositions = positions.map((position) => ({ ...position }));
    draftGroups = groupPositions(draftPositions);
    refreshSpinSelectors();
    renderVendorRows();
    renderHistory();
    updateSpinAvailability();
    updateBackupStatus();
    initializeSupabaseData();
  } else {
    readStoredPositions();
    loadStoreConfigurations();
    vendors = readStoredCollection(VENDORS_STORAGE_KEY, validateVendors, [], "os vendedores");
    rounds = readStoredCollection(ROUNDS_STORAGE_KEY, validateRounds, [], "o histórico");
    createInitialVendors();
    activeRoundId = activePendingRounds()[0]?.id || null;
    populateStoreOptions(vendorStoreInput);
    vendorStoreInput.value = STORES[0].id;
    populateVendorStoreOptions();
    prizeStoreSelect.value = selectedPrizeStoreId;
    positions = storeConfigurations[selectedPrizeStoreId];
    draftPositions = positions.map((position) => ({ ...position }));
    draftGroups = groupPositions(draftPositions);
    refreshSpinSelectors();
    renderVendorRows();
    renderHistory();
    updateBackupStatus();
  }
  if (isManagerPage) {
    introSection.hidden = true;
    gameSection.hidden = true;
    openAdminButton.hidden = true;
    soundToggle.hidden = true;
    closeAdminButton.textContent = "SAIR DO PAINEL";
    switchAdminTab("vendors");
  }
  soundTestPanel.hidden = isManagerPage ||
    new URLSearchParams(window.location.search).get("test-sounds") !== "1";
  updateSoundToggle();
  if (startupMessage) {
    setManagementFeedback(vendorFeedback, startupMessage, "error");
  }
  resizeConfettiCanvas();
  resizeWheel();
})();
