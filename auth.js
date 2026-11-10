
// =====================================
// ZOVI - AUTHENTICATION
// =====================================

document.addEventListener("DOMContentLoaded", () => {

    const supabase = window.zoviSupabase;

    const authScreen = document.getElementById("auth-screen");
    const loginForm = document.getElementById("login-form");
    const signupForm = document.getElementById("signup-form");

    const loginTab = document.getElementById("show-login");
    const signupTab = document.getElementById("show-signup");

    const authMessage = document.getElementById("auth-message");

    if (!supabase) {
        console.error("Supabase connection not found.");
        return;
    }

    // Show messages
    function showMessage(message, isError = false) {
        authMessage.textContent = message;
        authMessage.style.color = isError ? "#d9534f" : "#8062bd";
    }

    // Switch to Login
    loginTab.addEventListener("click", () => {
        loginForm.hidden = false;
        signupForm.hidden = true;

        loginTab.classList.add("active");
        signupTab.classList.remove("active");

        showMessage("");
    });

    // Switch to Sign Up
    signupTab.addEventListener("click", () => {
        signupForm.hidden = false;
        loginForm.hidden = true;

        signupTab.classList.add("active");
        loginTab.classList.remove("active");

        showMessage("");
    });

    // Student Registration
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const name = document.getElementById("signup-name").value.trim();
        const email = document.getElementById("signup-email").value.trim();
        const password = document.getElementById("signup-password").value;

        showMessage("Creating your account...");

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name
                }
            }
        });

        if (error) {
            showMessage(error.message, true);
            return;
        }

        if (data.session) {
            showMessage("Account created! Welcome to ZOVI.");
        } else {
            showMessage("Account created! Please check your email to verify your account.");
        }

        signupForm.reset();
    });

    // Student Login
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        showMessage("Logging in...");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            showMessage(error.message, true);
            return;
        }

        showMessage("Login successful!");
    });

    // Forgot Password
    document.getElementById("forgot-password").addEventListener("click", async () => {

        const email = document.getElementById("login-email").value.trim();

        if (!email) {
            showMessage("Please enter your email address first.", true);
            return;
        }

        showMessage("Sending password reset email...");

        const { error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) {
            showMessage(error.message, true);
            return;
        }

        showMessage("Password reset instructions have been sent to your email.");
    });


    // Check existing login session
async function checkSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
        showMessage(error.message, true);
        return;
    }

    authScreen.style.display = data.session ? "none" : "flex";

    window.dispatchEvent(new CustomEvent("zovi-auth-ready", {
        detail: { session: data.session }
    }));
}

// React to login/logout changes
supabase.auth.onAuthStateChange((event, session) => {
    authScreen.style.display = session ? "none" : "flex";

    window.dispatchEvent(new CustomEvent("zovi-auth-changed", {
        detail: { event, session }
    }));
});

checkSession();
    checkSession();

    console.log("ZOVI authentication initialized successfully.");

});
