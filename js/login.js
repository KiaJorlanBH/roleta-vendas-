"use strict";

(() => {
  const SESSION_KEY = "jorlan-sales-wheel-manager-session-v1";
  const MANAGER_USERNAME = "gerente";
  const form = document.querySelector("#login-form");
  const username = document.querySelector("#login-user");
  const password = document.querySelector("#login-password");
  const errorMessage = document.querySelector("#login-error");

  function getLoginErrorMessage(error) {
    const code = typeof error?.code === "string" ? error.code.toLowerCase() : "";
    const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";
    const name = typeof error?.name === "string" ? error.name.toLowerCase() : "";

    if (code === "email_not_confirmed" || /email not confirmed|email_not_confirmed/.test(message)) {
      return "Este e-mail ainda não foi confirmado. Verifique a caixa de entrada e confirme o cadastro no Supabase.";
    }
    if (code === "invalid_credentials" || /invalid login credentials|invalid credentials/.test(message)) {
      return "E-mail ou senha incorretos. Confira o e-mail configurado para o usuário gerente e a senha cadastrada no Supabase Auth.";
    }
    if (/invalid api key|invalid jwt/.test(message)) {
      return "A configuração de conexão com o Supabase foi rejeitada. Confira a URL e a chave pública em js/supabase-config.js.";
    }
    if (name.includes("fetch") || name === "typeerror" ||
        /failed to fetch|network error|load failed|timeout|timed out/.test(message)) {
      return "Não foi possível conectar ao Supabase. Verifique a internet, a URL do projeto e tente novamente.";
    }
    return "Não foi possível concluir o acesso ao painel. Verifique a configuração do Supabase e tente novamente.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const backend = window.jorlanSupabase;
    if (!backend?.isConfigured) {
      errorMessage.textContent = "O acesso ainda não foi conectado ao Supabase. Configure a URL do projeto, a chave pública e o e-mail do gerente em js/supabase-config.js; a senha deve ser a cadastrada em Supabase Auth.";
      errorMessage.hidden = false;
      return;
    }
    if (!backend.client?.auth) {
      errorMessage.textContent = "O serviço de autenticação não carregou. Verifique sua conexão com a internet e recarregue a página.";
      errorMessage.hidden = false;
      return;
    }

    if (username.value.trim().toLocaleLowerCase("pt-BR") !== MANAGER_USERNAME) {
      errorMessage.textContent = "Usuário ou senha incorretos. Confira os dados e tente novamente.";
      errorMessage.hidden = false;
      return;
    }

    try {
      const { data, error } = await backend.client.auth.signInWithPassword({
        email: backend.config.managerEmail.trim(),
        password: password.value
      });
      if (error) {
        errorMessage.textContent = getLoginErrorMessage(error);
        errorMessage.hidden = false;
        return;
      }
      if (!data.session) throw new Error("O serviço não iniciou uma sessão.");

      const { data: isManager, error: authorizationError } = await backend.client.rpc("is_manager");
      if (authorizationError) {
        await backend.client.auth.signOut();
        errorMessage.textContent = getLoginErrorMessage(authorizationError);
        errorMessage.hidden = false;
        return;
      }
      if (isManager !== true) {
        await backend.client.auth.signOut();
        errorMessage.textContent = "A conta foi autenticada, mas não está autorizada como gerente. Confira se o usuário correto está ativo em public.manager_accounts.";
        errorMessage.hidden = false;
        return;
      }

      sessionStorage.setItem(SESSION_KEY, "authenticated");
      window.location.assign("painel.html");
    } catch {
      errorMessage.textContent = "Não foi possível concluir o acesso ao painel. Verifique a conexão com o Supabase e tente novamente.";
      errorMessage.hidden = false;
    }
  });
})();
