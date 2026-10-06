const USERS_KEY = "dashboardUsers";
const SESSION_KEY = "dashboardSession";
const PASSWORD_ITERATIONS = 120000;

// Converte bytes para o formato salvo no armazenamento local.
function toBase64(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function fromBase64(value) {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
}

// Deriva a senha antes de guardá-la ou compará-la.
async function derivePassword(password, salt) {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );
    const hash = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" },
        key,
        256
    );
    return toBase64(hash);
}

function carregarUsuarios() {
    const savedUsers = localStorage.getItem(USERS_KEY);
    const users = savedUsers ? JSON.parse(savedUsers) : [];
    return Array.isArray(users) ? users : [];
}

function mostrarMensagem(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = `auth-message${type ? ` is-${type}` : ""}`;
}

// Salva novos cadastros sem armazenar a senha original.
function configurarCadastro() {
    const form = document.getElementById("cadastroForm");
    if (!form) return;

    const message = document.getElementById("authMessage");
    form.addEventListener("submit", async event => {
        event.preventDefault();
        mostrarMensagem(message, "", "");

        const username = form.elements.usuario.value.trim();
        const email = form.elements.email.value.trim();
        const password = form.elements.senha.value;
        const normalizedUsername = username.toLocaleLowerCase("pt-BR");
        const normalizedEmail = email.toLocaleLowerCase("pt-BR");

        try {
            const users = carregarUsuarios();
            const alreadyRegistered = users.some(user =>
                user.normalizedUsername === normalizedUsername ||
                user.normalizedEmail === normalizedEmail
            );

            if (alreadyRegistered) {
                mostrarMensagem(message, "Este usuário ou e-mail já está cadastrado.", "error");
                return;
            }

            const salt = crypto.getRandomValues(new Uint8Array(16));
            users.push({
                username,
                normalizedUsername,
                email,
                normalizedEmail,
                salt: toBase64(salt),
                passwordHash: await derivePassword(password, salt)
            });
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            window.location.href = "index.html?cadastro=sucesso";
        } catch {
            mostrarMensagem(message, "Não foi possível salvar o cadastro neste navegador.", "error");
        }
    });
}

// Confere as credenciais locais e inicia uma sessão nesta aba.
function configurarLogin() {
    const form = document.getElementById("loginForm");
    if (!form) return;

    const message = document.getElementById("authMessage");
    if (new URLSearchParams(window.location.search).get("cadastro") === "sucesso") {
        mostrarMensagem(message, "Cadastro realizado. Entre com sua conta.", "success");
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        mostrarMensagem(message, "", "");

        const identifier = form.elements.usuario.value.trim().toLocaleLowerCase("pt-BR");
        const password = form.elements.senha.value;

        try {
            const user = carregarUsuarios().find(savedUser =>
                savedUser.normalizedUsername === identifier ||
                savedUser.normalizedEmail === identifier
            );

            if (!user || await derivePassword(password, fromBase64(user.salt)) !== user.passwordHash) {
                mostrarMensagem(message, "Usuário ou senha inválidos.", "error");
                return;
            }

            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ username: user.username }));
            window.location.href = "dashboard.html";
        } catch {
            mostrarMensagem(message, "Não foi possível validar o login neste navegador.", "error");
        }
    });
}

// Redefine a senha local apenas quando usuário e e-mail correspondem à mesma conta.
function configurarRecuperacaoSenha() {
    const form = document.getElementById("recuperacaoForm");
    if (!form) return;

    const message = document.getElementById("authMessage");
    form.addEventListener("submit", async event => {
        event.preventDefault();
        mostrarMensagem(message, "", "");

        const username = form.elements.usuario.value.trim().toLocaleLowerCase("pt-BR");
        const email = form.elements.email.value.trim().toLocaleLowerCase("pt-BR");
        const newPassword = form.elements.novaSenha.value;
        const confirmedPassword = form.elements.confirmarNovaSenha.value;
        const submitButton = form.querySelector('[type="submit"]');

        if (newPassword !== confirmedPassword) {
            mostrarMensagem(message, "As senhas informadas não coincidem.", "error");
            return;
        }

        submitButton.disabled = true;
        try {
            const users = carregarUsuarios();
            const user = users.find(savedUser =>
                savedUser.normalizedUsername === username &&
                savedUser.normalizedEmail === email
            );

            if (!user) {
                mostrarMensagem(message, "Não encontramos uma conta com essa combinação de usuário e e-mail.", "error");
                return;
            }

            // Mantém o hash e o salt atuais se a senha escolhida já estiver em uso.
            const senhaAtualHash = await derivePassword(newPassword, fromBase64(user.salt));
            if (senhaAtualHash === user.passwordHash) {
                mostrarMensagem(message, "Essa senha já está sendo usada. Escolha uma senha diferente.", "error");
                return;
            }

            const salt = crypto.getRandomValues(new Uint8Array(16));
            user.salt = toBase64(salt);
            user.passwordHash = await derivePassword(newPassword, salt);
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
            sessionStorage.removeItem(SESSION_KEY);
            form.reset();
            mostrarMensagem(message, "Senha redefinida neste navegador. Você já pode entrar com a nova senha.", "success");
        } catch {
            mostrarMensagem(message, "Não foi possível salvar a nova senha neste navegador.", "error");
        } finally {
            submitButton.disabled = false;
        }
    });
}

// Exige uma sessão no dashboard e permite encerrar o acesso.
function configurarDashboard() {
    if (!document.body.classList.contains("dashboard")) return;

    let session;
    try {
        session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch {
        session = null;
    }

    if (!session?.username) {
        window.location.replace("index.html");
        return;
    }

    document.getElementById("usuarioLogado").textContent = session.username;
    document.getElementById("btnSair").addEventListener("click", () => {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = "index.html";
    });
}

configurarCadastro();
configurarLogin();
configurarRecuperacaoSenha();
configurarDashboard();