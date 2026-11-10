/* =========================================
   ZOVI MEMBERSHIP — DEMO PLAN SWITCHER
   No payment processing or real subscription.
   ========================================= */

(() => {
    const STORAGE_KEY = "zovi_demo_membership";

    const currentPlan = document.getElementById(
        "membership-current-plan"
    );

    const currentDescription = document.getElementById(
        "membership-current-description"
    );

    const premiumButton = document.getElementById(
        "demo-premium-button"
    );

    const membershipStatus = document.querySelector(
        ".membership-status"
    );

    if (!currentPlan || !premiumButton) return;

    function getPlan() {
        return localStorage.getItem(STORAGE_KEY) || "free";
    }

    function renderPlan() {
        const plan = getPlan();

        if (plan === "premium") {
            currentPlan.textContent = "Premium Demo";
            currentDescription.textContent =
                "You're viewing the ZOVI Premium demo experience.";

            premiumButton.textContent = "Return to Free Demo";

            if (membershipStatus) {
                membershipStatus.textContent = "PREMIUM · DEMO";
            }
        } else {
            currentPlan.textContent = "Free Plan";
            currentDescription.textContent =
                "You're learning with ZOVI Free.";

            premiumButton.textContent = "Try Premium Demo";

            if (membershipStatus) {
                membershipStatus.textContent = "FREE · ACTIVE";
            }
        }
    }

    premiumButton.addEventListener("click", () => {
        const current = getPlan();

        if (current === "premium") {
            localStorage.setItem(STORAGE_KEY, "free");
            showMembershipMessage("Returned to the Free demo.");
        } else {
            localStorage.setItem(STORAGE_KEY, "premium");
            showMembershipMessage(
                "Premium demo activated! No payment was made."
            );
        }

        renderPlan();
    });

    function showMembershipMessage(message) {
        const toast = document.getElementById("toast");

        if (!toast) {
            alert(message);
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(showMembershipMessage.timer);

        showMembershipMessage.timer = setTimeout(() => {
            toast.classList.remove("show");
        }, 3000);
    }

    renderPlan();
})();