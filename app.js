const API_BASE_URL = "http://localhost:5000";

async function testBackendConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        const data = await response.json();

        console.log("Backend connection successful:", data);
    } catch (error) {
        console.error("Backend connection failed:", error);
    }
}
let pendingChatFiles = {
    chatInput: [],
    globalChatInput: []
};

const MAX_CHAT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_CHAT_CONTEXT = 30000;
/* =========================================
   ZOVI - MAIN APPLICATION JAVASCRIPT
   ========================================= */


/* 1. APPLICATION DATA */

const STORAGE_KEY = "zovi_subjects";
const NAVIGATION_STORAGE_PREFIX = "zovi_navigation_";

let subjects = [];
let currentSubjectId = null;
let currentWorkspaceTab = "materials";
let currentUserId = null;
let initializedUserId = null;
let conversations = [];
let currentConversationId = null;

// Save the student's last opened page and workspace tab.
function saveNavigationState(pageId) {
    if (!currentUserId) return;

    const navigationState = {
        page: pageId,
        subjectId: currentSubjectId,
        tab: currentWorkspaceTab
    };

    localStorage.setItem(
        NAVIGATION_STORAGE_PREFIX + currentUserId,
        JSON.stringify(navigationState)
    );
}

// Read the student's saved navigation.
function getSavedNavigationState() {
    if (!currentUserId) return null;

    try {
        const saved = localStorage.getItem(
            NAVIGATION_STORAGE_PREFIX + currentUserId
        );

        return saved ? JSON.parse(saved) : null;
    } catch (error) {
        console.error("Could not restore navigation:", error);
        return null;
    }
}

/* 2. LOAD SAVED SUBJECTS */
async function loadSubjects() {
    try {
        // Load all subjects.
        const { data: subjectData, error: subjectError } =
            await window.zoviSupabase
                .from("subjects")
                .select("*")
                .order("created_at", { ascending: false });

        if (subjectError) throw subjectError;

        // Load all uploaded material records.
        const { data: materialData, error: materialError } =
            await window.zoviSupabase
                .from("materials")
                .select("*");

        if (materialError) throw materialError;

        // Attach each material to its correct subject.
        subjects = (subjectData || []).map(subject => ({
            ...subject,
            materials: (materialData || []).filter(
                material => material.subject_id === subject.id
            )
        }));

    } catch (error) {
        console.error("Could not load subjects:", error);
        subjects = [];
        showToast("Could not load your subjects. Please refresh.");
    }

    renderSubjects();
}
// Restore the student's last opened page after subjects load.
function restoreNavigationState() {
    const savedState = getSavedNavigationState();

    if (!savedState) {
        navigateToPage("dashboard");
        return;
    }

    if (savedState.page === "subject-workspace") {
        const subjectExists = subjects.some(
            subject => subject.id === savedState.subjectId
        );

        if (subjectExists) {
            openSubjectWorkspace(savedState.subjectId);

            const validTabs = [
                "materials", "ai", "flashcards", "quizzes", "progress"
            ];

            showWorkspaceTab(
                validTabs.includes(savedState.tab)
                    ? savedState.tab
                    : "materials"
            );

            return;
        }
    }

    const targetPage = document.getElementById(savedState.page);

    if (targetPage && targetPage.classList.contains("page")) {
        navigateToPage(savedState.page);
    } else {
        navigateToPage("dashboard");
    }
}
/* 3. SAVE SUBJECTS */

function saveSubjects() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(subjects)
        );
    } catch (error) {
        console.error("Could not save subjects:", error);
        showToast("Could not save subjects in this browser.");
    }
}


/* 4. NOTIFICATION MESSAGE */

function showToast(message) {
    const toast = document.getElementById("toast");

    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


/* 5. PAGE NAVIGATION */

function navigateToPage(pageId) {
   
    const pages = document.querySelectorAll(".page");
    const navigationItems = document.querySelectorAll(".nav-item");

    const targetPage = document.getElementById(pageId);

    if (!targetPage) return;

    pages.forEach(page => {
        page.classList.remove("active");
    });

    targetPage.classList.add("active");
    if (pageId === "progress") {
    renderOverallProgress();
}

    navigationItems.forEach(item => {
        item.classList.toggle(
            "active",
            item.dataset.view === pageId
        );
    });

    const breadcrumb = document.getElementById("breadcrumb");

    if (breadcrumb) {
        breadcrumb.textContent =
            pageId === "ai-assistant"
                ? "AI Assistant"
                : pageId.charAt(0).toUpperCase() + pageId.slice(1);
    }
saveNavigationState(pageId);
    closeSidebar();
}


/* 6. MOBILE SIDEBAR */

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
        sidebar.classList.toggle("open");
    }
}

function closeSidebar() {
    const sidebar = document.getElementById("sidebar");

    if (sidebar) {
        sidebar.classList.remove("open");
    }
}


/* 7. CREATE SUBJECT MODAL */

function openSubjectModal() {
    const modal = document.getElementById("subjectModal");

    if (modal) {
        modal.showModal();
    }
}

function closeSubjectModal() {
    const modal = document.getElementById("subjectModal");

    if (modal) {
        modal.close();
    }
}


/* 8. CREATE A SUBJECT */
async function createSubject(event) {
    event.preventDefault();
    const form = event.currentTarget;

if (form.dataset.submitting === "true") {
    return;
}

form.dataset.submitting = "true";

const submitButton = form.querySelector('button[type="submit"]');

if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Creating...";
}

    const nameInput = document.getElementById("subjectName");
    const descriptionInput = document.getElementById("subjectDescription");

    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!name) {
        showToast("Please enter a subject name.");
        return;
    }

    try {
        const { data: userData, error: userError } =
            await window.zoviSupabase.auth.getUser();

        if (userError || !userData.user) {
            throw new Error("Please log in before creating a subject.");
        }

        const { data, error } = await window.zoviSupabase
            .from("subjects")
            .insert({
                user_id: userData.user.id,
                name: name,
                description: description
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        subjects.unshift(data);

        renderSubjects();

        document.getElementById("subjectForm").reset();
        closeSubjectModal();

        showToast("Your subject was created successfully!");

    } catch (error) {
        console.error("Could not create subject:", error);
        showToast(error.message || "Could not create subject.");
    }
    finally {
    form.dataset.submitting = "false";

    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Create Subject";
    }
}
}

/* 9. DISPLAY SUBJECTS */

function createSubjectCard(subject) {
    const card = document.createElement("button");

    card.type = "button";
    card.className = "subject-card";
    card.dataset.subjectId = subject.id;

    const icon = document.createElement("div");
    icon.className = "subject-icon";
    icon.textContent = "📚";

    const title = document.createElement("h4");
    title.textContent = subject.name;

    const description = document.createElement("p");
    description.textContent =
        subject.description || "Your personal study workspace";

    const materialCount = document.createElement("p");
    materialCount.textContent =
        `${subject.materials?.length || 0} study materials`;

    card.append(icon, title, description, materialCount);

    return card;
}

function renderSubjects() {
    const dashboardContainer =
        document.getElementById("dashboardSubjects");

    const allSubjectsContainer =
        document.getElementById("allSubjects");

    const totalSubjects =
        document.getElementById("totalSubjects");

    const totalNotes =
        document.getElementById("totalNotes");

    const totalFlashcards =
        document.getElementById("totalFlashcards");

    const totalQuizzes =
        document.getElementById("totalQuizzes");

    if (totalSubjects) {
        totalSubjects.textContent = subjects.length;
    }

    if (totalNotes) {
        totalNotes.textContent = subjects.reduce(
            (total, subject) =>
                total + (subject.materials?.length || 0),
            0
        );
    }

    if (totalFlashcards) {
        totalFlashcards.textContent = subjects.reduce(
            (total, subject) =>
                total + (subject.flashcards?.length || 0),
            0
        );
    }

    if (totalQuizzes) {
        totalQuizzes.textContent = subjects.reduce(
            (total, subject) =>
                total + (subject.quizzes?.length || 0),
            0
        );
    }

    [dashboardContainer, allSubjectsContainer].forEach(
        container => {
            if (!container) return;

            container.replaceChildren();

            if (subjects.length === 0) {
                const empty = document.createElement("div");

                empty.className = "empty-state";
                empty.innerHTML = `
                    <div>📚</div>
                    <h4>Your study space starts here</h4>
                    <p>Create your first subject to get started.</p>
                `;

                container.appendChild(empty);
                return;
            }

            subjects.forEach(subject => {
                container.appendChild(
                    createSubjectCard(subject)
                );
            });
        }
    );
}


/* 10. OPEN SUBJECT WORKSPACE */

function openSubjectWorkspace(subjectId) {
    const subject = subjects.find(
        item => item.id === subjectId
    );

    if (!subject) return;

    currentSubjectId = subjectId;
    currentConversationId = null;
conversations = [];

    document.getElementById(
        "workspaceSubjectName"
    ).textContent = subject.name;

    document.getElementById(
        "workspaceSubjectDescription"
    ).textContent =
        subject.description || "Your personal subject workspace.";

    renderSubjectMaterials();
renderSubjectProgress();

navigateToPage("subject-workspace");
   const savedState = getSavedNavigationState();

const savedTab =
    savedState?.subjectId === subjectId
        ? savedState.tab
        : "materials";

showWorkspaceTab(savedTab || "materials");
}


/* 11. SUBJECT WORKSPACE TABS */

function showWorkspaceTab(tabName) {
     currentWorkspaceTab = tabName;
    saveNavigationState("subject-workspace");
    document.querySelectorAll(".workspace-tab").forEach(
        tab => {
            tab.classList.toggle(
                "active",
                tab.dataset.workspaceTab === tabName
            );
        }
    );

    document.querySelectorAll(".workspace-panel").forEach(
        panel => {
            panel.classList.remove("active");
        }
    );

    const selectedPanel =
        document.getElementById(`workspace-${tabName}`);

    if (selectedPanel) {
        selectedPanel.classList.add("active");
    }
    if (tabName === "ai" && currentSubjectId) {
    loadConversations(currentSubjectId);
}
}


/* 12. DISPLAY SUBJECT MATERIALS */
/* 12. DISPLAY SUBJECT MATERIALS */

function getMaterialIcon(fileName = "") {
    const extension = fileName.split(".").pop().toLowerCase();

    const icons = {
        pdf: "📕",
        ppt: "📊",
        pptx: "📊",
        doc: "📘",
        docx: "📘",
        txt: "📄"
    };

    return icons[extension] || "📁";
}

function formatFileSize(bytes = 0) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function renderSubjectMaterials() {
    const container = document.getElementById("subjectMaterials");

    if (!container) return;

    const subject = subjects.find(
        item => item.id === currentSubjectId
    );

    if (!subject) return;

    container.replaceChildren();

    const loading = document.createElement("p");
    loading.className = "empty-message";
    loading.textContent = "Loading your study materials...";
    container.appendChild(loading);

    try {
        const { data, error } = await window.zoviSupabase
            .from("materials")
            .select("*")
            .eq("subject_id", currentSubjectId)
            .order("created_at", { ascending: false });

        if (error) throw error;

        subject.materials = data || [];
        container.replaceChildren();

        const toolbar = document.createElement("div");
        toolbar.className = "materials-toolbar";

        const count = document.createElement("p");
        count.textContent =
            `${subject.materials.length} ${subject.materials.length === 1 ? "file" : "files"}`;

        toolbar.appendChild(count);
        container.appendChild(toolbar);

        if (subject.materials.length === 0) {
            const empty = document.createElement("div");
            empty.className = "materials-empty-state";

            const icon = document.createElement("div");
            icon.textContent = "📚";

            const heading = document.createElement("h3");
            heading.textContent = "Your library is waiting";

            const description = document.createElement("p");
            description.textContent =
                "Upload notes, presentations and documents to keep your study materials organised.";

            const uploadButton = document.createElement("button");
            uploadButton.type = "button";
            uploadButton.className = "primary-button";
            uploadButton.textContent = "+ Upload your first file";
            uploadButton.dataset.action = "upload-material";

            empty.append(icon, heading, description, uploadButton);
            container.appendChild(empty);

            return;
        }

        const grid = document.createElement("div");
        grid.className = "materials-grid";

        subject.materials.forEach(material => {
            const card = document.createElement("article");
            card.className = "material-card";

            const icon = document.createElement("div");
            icon.className = "material-file-icon";
            icon.textContent = getMaterialIcon(material.file_name);

            const content = document.createElement("div");
            content.className = "material-card-content";

            const title = document.createElement("h4");
            title.textContent = material.file_name;
            title.title = material.file_name;

            const details = document.createElement("p");
            details.textContent =
                `${formatFileSize(material.file_size)} · ${new Date(material.created_at).toLocaleDateString()}`;

            const status = document.createElement("span");
            status.className = "material-status";
            status.textContent =
                material.extracted_text
                    ? "Text extracted"
                    : "Uploaded";

            content.append(title, details, status);

            const actions = document.createElement("div");
            actions.className = "material-card-actions";

            const downloadButton = document.createElement("button");
            downloadButton.type = "button";
            downloadButton.className = "material-action-button";
            downloadButton.textContent = "Download";
            downloadButton.dataset.downloadMaterial = material.id;

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "material-delete-button";
            deleteButton.textContent = "Delete";
            deleteButton.dataset.deleteMaterial = material.id;

            actions.append(downloadButton, deleteButton);
            card.append(icon, content, actions);
            grid.appendChild(card);
        });

        container.appendChild(grid);

    } catch (error) {
        console.error("Could not load study materials:", error);

        container.replaceChildren();

        const message = document.createElement("p");
        message.className = "empty-message";
        message.textContent = "Could not load your study materials.";

        container.appendChild(message);
        showToast("Could not load your study materials.");
    }
}
async function deleteMaterial(materialId) {
    const subject = subjects.find(
        item => item.id === currentSubjectId
    );

    if (!subject) return;

    const confirmed = confirm(
        "Are you sure you want to permanently delete this study material?"
    );

    if (!confirmed) return;

    try {
        showToast("Deleting study material...");

        const { data: material, error: fetchError } =
            await window.zoviSupabase
                .from("materials")
                .select("*")
                .eq("id", materialId)
                .eq("subject_id", currentSubjectId)
                .single();

        if (fetchError) throw fetchError;

        if (material.storage_path) {
            const { error: storageError } =
                await window.zoviSupabase
                    .storage
                    .from("study-materials")
                    .remove([material.storage_path]);

            if (storageError) throw storageError;
        }

        const { error: deleteError } =
            await window.zoviSupabase
                .from("materials")
                .delete()
                .eq("id", materialId)
                .eq("subject_id", currentSubjectId);

        if (deleteError) throw deleteError;

        subject.materials = (subject.materials || []).filter(
            item => item.id !== materialId
        );

        await renderSubjectMaterials();
        renderSubjects();

        showToast("Study material deleted successfully!");

    } catch (error) {
        console.error("Material deletion failed:", error);
        showToast(error.message || "Could not delete study material.");
    }
}
/* DOWNLOAD STUDY MATERIAL */

async function downloadMaterial(materialId) {
    try {
        const { data: material, error: fetchError } =
            await window.zoviSupabase
                .from("materials")
                .select("*")
                .eq("id", materialId)
                .eq("subject_id", currentSubjectId)
                .single();

        if (fetchError) throw fetchError;

        const { data, error } = await window.zoviSupabase
            .storage
            .from("study-materials")
            .createSignedUrl(material.storage_path, 60);

        if (error) throw error;

        const link = document.createElement("a");
        link.href = data.signedUrl;
        link.download = material.file_name;
        link.target = "_blank";

        document.body.appendChild(link);
        link.click();
        link.remove();

    } catch (error) {
        console.error("Material download failed:", error);
        showToast(error.message || "Could not download this file.");
    }
}
/* 13. UPLOAD MATERIAL MODAL */

function openUploadModal() {
    if (!currentSubjectId) {
        showToast("Please open a subject first.");
        return;
    }

    document.getElementById("uploadModal").showModal();
}

function closeUploadModal() {
    document.getElementById("uploadModal").close();
}


/* 14. HANDLE MATERIAL SELECTION */
/* PDF TEXT EXTRACTION */
async function extractPdfText(file) {
    if (!window.pdfjsLib) {
        throw new Error(
            "PDF reader is not loaded. Refresh ZOVI and try again."
        );
    }

    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const arrayBuffer = await file.arrayBuffer();

    const pdf = await window.pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer)
    }).promise;

    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();

        const pageText = content.items
            .filter(item => typeof item.str === "string")
            .map(item => item.str)
            .join(" ")
            .trim();

        if (pageText) {
            pages.push(`Page ${pageNumber}\n${pageText}`);
        }
    }

    const extractedText = pages.join("\n\n").trim();

    console.log(
        "PDF extraction completed:",
        extractedText.length,
        "characters"
    );

    if (!extractedText) {
        throw new Error(
            "No selectable text was found in this PDF. It may be scanned or image-based."
        );
    }

    return extractedText;
}
async function handleMaterialSelection(event) {
    event.preventDefault();

    const form = event.currentTarget;

    if (form.dataset.submitting === "true") return;

    const fileInput = document.getElementById("materialFile");
    const file = fileInput?.files?.[0];

    if (!file) {
        showToast("Please choose a file first.");
        return;
    }

    const subject = subjects.find(
        item => item.id === currentSubjectId
    );

    if (!subject) {
        showToast("Please open a subject first.");
        return;
    }

    const maximumSize = 50 * 1024 * 1024;

    if (file.size > maximumSize) {
        showToast("Your file is larger than the 50 MB limit.");
        return;
    }

    const allowedExtensions = [
        "pdf", "ppt", "pptx", "doc", "docx", "txt"
    ];

    const extension = file.name.split(".").pop().toLowerCase();

    if (!allowedExtensions.includes(extension)) {
        showToast("This file format is not supported.");
        return;
    }

    form.dataset.submitting = "true";

    const submitButton = form.querySelector(
        'button[type="submit"]'
    );

    const progress = document.getElementById(
        "materialUploadProgress"
    );

    const progressText = document.getElementById(
        "materialUploadProgressText"
    );

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Uploading...";
    }

    if (progress) progress.hidden = false;

    let storagePath = null;

    try {
        if (progressText) {
            progressText.textContent = "Preparing your file...";
        }

        const { data: userData, error: userError } =
            await window.zoviSupabase.auth.getUser();

        if (userError || !userData.user) {
            throw new Error("Please log in again.");
        }

        const userId = userData.user.id;

        const safeFileName = file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
        );

        storagePath =
            `${userId}/${subject.id}/${Date.now()}-${safeFileName}`;

        let extractedText = null;

        if (
            file.type === "application/pdf" ||
            extension === "pdf"
        ) {
            if (progressText) {
                progressText.textContent = "Reading your PDF...";
            }

            extractedText = await extractPdfText(file);
        }

        if (progressText) {
            progressText.textContent = "Uploading your file...";
        }

        const { error: uploadError } =
            await window.zoviSupabase.storage
                .from("study-materials")
                .upload(storagePath, file, {
                    contentType: file.type || "application/octet-stream",
                    upsert: false
                });

        if (uploadError) throw uploadError;

        if (progressText) {
            progressText.textContent = "Saving your file details...";
        }

        const { data, error: databaseError } =
            await window.zoviSupabase
                .from("materials")
                .insert({
                    subject_id: subject.id,
                    file_name: file.name,
                    storage_path: storagePath,
                    file_type: file.type || extension,
                    file_size: file.size,
                    extracted_text: extractedText,
                    processing_status: "uploaded"
                })
                .select()
                .single();

        if (databaseError) {
            await window.zoviSupabase.storage
                .from("study-materials")
                .remove([storagePath]);

            storagePath = null;
            throw databaseError;
        }

        subject.materials = subject.materials || [];
        subject.materials.push(data);

        await renderSubjectMaterials();
        renderSubjects();

        fileInput.value = "";

        if (progress) progress.hidden = true;

        closeUploadModal();

        showToast("Your study material was uploaded successfully!");

    } catch (error) {
        console.error("Material upload failed:", error);

        if (storagePath) {
            await window.zoviSupabase.storage
                .from("study-materials")
                .remove([storagePath]);
        }

        showToast(error.message || "Could not upload your file.");

    } finally {
        form.dataset.submitting = "false";

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Upload Material";
        }

        if (progress) progress.hidden = true;
    }
}


/* 15. AI CHAT PLACEHOLDER */


function formatAIMessage(message) {
    const formattedHTML = marked.parse(String(message), {
        gfm: true,
        breaks: false
    });

    return DOMPurify.sanitize(formattedHTML);
}

function addChatMessage(container, message, type) {
    const bubble = document.createElement("div");

    bubble.className =
        type === "user" ? "user-message" : "assistant-message";

  if (type === "assistant") {
    bubble.innerHTML = formatAIMessage(message);

    if (typeof renderMathInElement === "function") {
        renderMathInElement(bubble, {
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "$", right: "$", display: false },
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true }
            ],
            throwOnError: false
        });
    }

} else {
    bubble.textContent = message;
}

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

// SUBJECT CONVERSATION MANAGEMENT

async function loadConversations(subjectId) {
    const list = document.getElementById("chatHistoryList");
    if (!currentUserId || !subjectId || !list) return;

    list.textContent = "Loading conversations...";

    const { data, error } = await window.zoviSupabase
        .from("conversations")
        .select("*")
        .eq("user_id", currentUserId)
        .eq("subject_id", subjectId)
        .order("updated_at", { ascending: false });

    if (error) {
        console.error("Conversation loading error:", error);
        list.textContent = "Could not load conversations.";
        return;
    }

    conversations = data || [];

    if (
        currentConversationId &&
        !conversations.some(c => c.id === currentConversationId)
    ) {
        currentConversationId = null;
    }

    renderConversationList();

    if (currentConversationId) {
        await openConversation(currentConversationId);
    } else if (conversations.length > 0) {
        await openConversation(conversations[0].id);
    } else {
        currentConversationId = null;
        showEmptyConversation();
    }
}

function renderConversationList() {
    const list = document.getElementById("chatHistoryList");
    if (!list) return;

    list.replaceChildren();

    if (!conversations.length) {
        const empty = document.createElement("p");
        empty.className = "chat-history-empty";
        empty.textContent = "No conversations yet. Start a new chat!";
        list.appendChild(empty);
        return;
    }

    conversations.forEach(conversation => {
        const item = document.createElement("div");
        item.className = "chat-history-item";

        if (conversation.id === currentConversationId) {
            item.classList.add("active");
        }

        const title = document.createElement("button");
        title.type = "button";
        title.className = "chat-history-title";
        title.textContent = conversation.title || "New Chat";
        title.addEventListener("click", () => openConversation(conversation.id));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "chat-history-delete";
        deleteButton.textContent = "×";
        deleteButton.title = "Delete conversation";
        deleteButton.addEventListener("click", () => deleteConversation(conversation.id));

        item.append(title, deleteButton);
        list.appendChild(item);
    });
}

function showEmptyConversation() {
    const messages = document.getElementById("chatMessages");
    if (!messages) return;

    messages.replaceChildren();

    const welcome = document.createElement("div");
    welcome.className = "assistant-message";
    welcome.textContent = "Hi! I'm ZOVI. What would you like to understand today?";
    messages.appendChild(welcome);
}

async function createConversation() {
    if (!currentUserId || !currentSubjectId) {
        throw new Error("Please open a subject before starting a chat.");
    }

    const { data, error } = await window.zoviSupabase
        .from("conversations")
        .insert({
            user_id: currentUserId,
            subject_id: currentSubjectId,
            title: "New Chat"
        })
        .select()
        .single();

    if (error) throw error;

    conversations.unshift(data);
    currentConversationId = data.id;

    renderConversationList();
    showEmptyConversation();

    return data.id;
}

async function openConversation(conversationId) {
    currentConversationId = conversationId;
    renderConversationList();

    const messages = document.getElementById("chatMessages");
    if (!messages) return;

    messages.textContent = "Loading messages...";

    const { data, error } = await window.zoviSupabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Message loading error:", error);
        messages.textContent = "Could not load this conversation.";
        return;
    }

    messages.replaceChildren();

    if (!data || data.length === 0) {
        const welcome = document.createElement("div");
        welcome.className = "assistant-message";
        welcome.textContent = "Hi! I'm ZOVI. What would you like to understand today?";
        messages.appendChild(welcome);
        return;
    }

    data.forEach(message => {
        addChatMessage(messages, message.content, message.role);
    });

    messages.scrollTop = messages.scrollHeight;
}

async function saveConversationMessage(conversationId, role, content) {
    const { error } = await window.zoviSupabase
        .from("chat_messages")
        .insert({
            conversation_id: conversationId,
            user_id: currentUserId,
            role,
            content
        });

    if (error) throw error;

    const updates = {
        updated_at: new Date().toISOString()
    };

    if (role === "user") {
        const conversation = conversations.find(c => c.id === conversationId);

        if (conversation && conversation.title === "New Chat") {
            updates.title = content.length > 42
                ? content.slice(0, 42) + "..."
                : content;
            conversation.title = updates.title;
        }
    }

    const { error: updateError } = await window.zoviSupabase
        .from("conversations")
        .update(updates)
        .eq("id", conversationId)
        .eq("user_id", currentUserId);

    if (updateError) throw updateError;

    conversations.sort((a, b) =>
        new Date(b.updated_at) - new Date(a.updated_at)
    );

    renderConversationList();
}

async function deleteConversation(conversationId) {
    if (!confirm("Delete this conversation and all its messages?")) return;

    const { error } = await window.zoviSupabase
        .from("conversations")
        .delete()
        .eq("id", conversationId)
        .eq("user_id", currentUserId);

    if (error) {
        console.error("Conversation deletion error:", error);
        alert("Could not delete this conversation.");
        return;
    }

    conversations = conversations.filter(c => c.id !== conversationId);

    if (currentConversationId === conversationId) {
        currentConversationId = null;
    }

    renderConversationList();

    if (conversations.length > 0) {
        await openConversation(conversations[0].id);
    } else {
        showEmptyConversation();
    }
}
function renderChatAttachments(inputId) {
    const previewId = inputId === "chatInput"
        ? "chatAttachmentPreview"
        : "globalChatAttachmentPreview";

    const preview = document.getElementById(previewId);
    if (!preview) return;

    preview.replaceChildren();

    pendingChatFiles[inputId].forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "chat-attachment-chip";

        const name = document.createElement("span");
        name.textContent = `📎 ${file.name}`;

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.title = "Remove attachment";

        remove.addEventListener("click", () => {
            pendingChatFiles[inputId].splice(index, 1);
            renderChatAttachments(inputId);
        });

        item.append(name, remove);
        preview.appendChild(item);
    });
}

function handleChatFileSelection(inputId, files) {
    const currentFiles = pendingChatFiles[inputId];

    for (const file of files) {
        const isPDF =
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf");

        const isTXT =
            file.type === "text/plain" ||
            file.name.toLowerCase().endsWith(".txt");

        if (!isPDF && !isTXT) {
            showToast("Please attach a PDF or TXT file.");
            continue;
        }

        if (file.size > MAX_CHAT_FILE_SIZE) {
            showToast(`${file.name} is larger than 5 MB.`);
            continue;
        }

        if (currentFiles.some(item =>
            item.name === file.name && item.size === file.size
        )) {
            continue;
        }

        if (currentFiles.length >= 5) {
            showToast("You can attach up to 5 files per message.");
            break;
        }

        currentFiles.push(file);
    }

    renderChatAttachments(inputId);
}

async function readChatAttachments(inputId) {
    const files = pendingChatFiles[inputId];
    const extractedFiles = [];
    let remaining = MAX_CHAT_CONTEXT;

    for (const file of files) {
        if (remaining <= 0) break;

        let extractedText = "";

        if (
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf")
        ) {
            extractedText = await extractPdfText(file);
        } else {
            extractedText = await file.text();
        }

        extractedText = extractedText.trim();

        if (!extractedText) {
            throw new Error(
                `${file.name} contains no readable text. Scanned PDFs need OCR, which isn't supported yet.`
            );
        }

        const limitedText = extractedText.slice(0, remaining);

        extractedFiles.push(
            `ATTACHED FILE: ${file.name}\n${limitedText}`
        );

        remaining -= limitedText.length;
    }

    return extractedFiles.join("\n\n");
}
async function handleChat(event, inputId, messagesId) {
    event.preventDefault();

    const input = document.getElementById(inputId);
    const messages = document.getElementById(messagesId);
    const isSubjectChat = messagesId === "chatMessages";

   const typedMessage = input.value.trim();
const hasAttachments = pendingChatFiles[inputId].length > 0;

if (!typedMessage && !hasAttachments) return;

const message = typedMessage ||
    "Please explain and summarize the attached file(s).";

    let conversationId = null;
    let history = [];
    let materialContext = "";
    let subjectName = "";

    try {
        if (isSubjectChat) {
            if (!currentUserId || !currentSubjectId) {
                throw new Error("Please open a subject first.");
            }

            const subject = subjects.find(
                item => item.id === currentSubjectId
            );

            subjectName = subject?.name || "";

            // Create a conversation if this is a new chat.
            if (!currentConversationId) {
                await createConversation();
            }

            conversationId = currentConversationId;

            // Load the previous messages BEFORE saving the new question.
            const { data: previousMessages, error: historyError } =
                await window.zoviSupabase
                    .from("chat_messages")
                    .select("role, content")
                    .eq("conversation_id", conversationId)
                    .order("created_at", { ascending: false })
                    .limit(12);

            if (historyError) throw historyError;

            history = (previousMessages || []).reverse();

            // Fetch materials belonging ONLY to this subject.
            const { data: materials, error: materialError } =
                await window.zoviSupabase
                    .from("materials")
                    .select("file_name, extracted_text")
                    .eq("subject_id", currentSubjectId);

            if (materialError) throw materialError;

            // Include extracted PDF text, with a context limit.
            let remainingCharacters = 30000;

            materialContext = (materials || [])
                .filter(item =>
                    typeof item.extracted_text === "string" &&
                    item.extracted_text.trim()
                )
                .map(item => {
                    if (remainingCharacters <= 0) return "";

                    const text = item.extracted_text.slice(
                        0,
                        remainingCharacters
                    );

                    remainingCharacters -= text.length;

                    return `MATERIAL: ${item.file_name}\n${text}`;
                })
                .filter(Boolean)
                .join("\n\n");
                console.log("ZOVI MATERIAL CHECK:", {
    subjectId: currentSubjectId,
    subjectName,
    materialsFound: materials?.length || 0,
    extractedFiles: materials?.filter(
        item => item.extracted_text?.trim()
    ).map(item => item.file_name),
    materialContextLength: materialContext.length,
    materialPreview: materialContext.slice(0, 500)
});

            // Save the student's new question.
            await saveConversationMessage(
                conversationId,
                "user",
                message
            );
        }

        addChatMessage(messages, message, "user");

        const thinkingBubble = document.createElement("div");
        thinkingBubble.className = "assistant-message thinking";
        thinkingBubble.textContent = "ZOVI is thinking...";
        messages.appendChild(thinkingBubble);
        messages.scrollTop = messages.scrollHeight;

        input.value = "";
console.log("ZOVI HISTORY CHECK:", JSON.stringify({
    conversationId,
    historyCount: history.length,
    history,
    subjectName
}, null, 2));
const attachmentContext = await readChatAttachments(inputId);

// Give newly attached files priority.
const attachmentFirst = attachmentContext.slice(0, MAX_CHAT_CONTEXT);

const remainingSpace = Math.max(
    0,
    MAX_CHAT_CONTEXT - attachmentFirst.length
);

// Use saved subject material only if space remains.
const savedMaterial = materialContext.slice(0, remainingSpace);

const completeMaterialContext = [
    attachmentFirst,
    savedMaterial
].filter(Boolean).join("\n\n");
        const response = await fetch(`${API_BASE_URL}/api/ai/ask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: message,
                history,
                materialContext: completeMaterialContext,
                subjectName
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "AI request failed.");
        }

        thinkingBubble.remove();

        addChatMessage(messages, data.answer, "assistant");
        // Show and speak the reply when Voice Mode is open
if (!voiceModeOverlay.hidden) {
    const voiceResponse = document.getElementById("voiceResponse");

    if (voiceResponse) {
        voiceResponse.textContent = data.answer;
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();

        const cleanSpeechText = data.answer
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[>#*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const spokenReply = new SpeechSynthesisUtterance(cleanSpeechText);

const selectedVoice = getZoviVoice();

if (selectedVoice) {
    spokenReply.voice = selectedVoice;
}

spokenReply.lang = selectedVoice?.lang || "en-IN";
spokenReply.rate = 1.0;
spokenReply.pitch = 0.95;
spokenReply.volume = 1;

window.speechSynthesis.speak(spokenReply);

    }
}
        pendingChatFiles[inputId] = [];
renderChatAttachments(inputId);

        if (isSubjectChat) {
            await saveConversationMessage(
                conversationId,
                "assistant",
                data.answer
            );
        }

    } catch (error) {
        console.error("ZOVI AI error:", error);

        const thinkingBubble = messages.querySelector(".thinking");

        if (thinkingBubble) {
            thinkingBubble.remove();
        }

        addChatMessage(
            messages,
            error.message || "Sorry! I couldn't answer right now. Please try again.",
            "assistant"
        );
    }

    messages.scrollTop = messages.scrollHeight;
}

/* 16. BUTTON ACTIONS */

function handleAction(action) {

    switch (action) {

        case "create-subject":
            openSubjectModal();
            break;

        case "close-subject-modal":
            closeSubjectModal();
            break;

        case "back-to-subjects":
            navigateToPage("subjects");
            break;

        case "upload-material":
            openUploadModal();
            break;

        case "close-upload-modal":
            closeUploadModal();
            break;

        case "premium":
            showToast("Premium features will be added later.");
            break;

        case "generate-flashcards":
    generateFlashcards();
    break;

        case "generate-quiz":
    generateQuiz();
    break;

        default:
            console.log("Unknown action:", action);
    }
}  
async function generateQuiz() {
    if (!currentSubjectId) {
        showToast("Please open a subject first.");
        return;
    }

    const button = document.querySelector(
        '[data-action="generate-quiz"]'
    );

    try {
        if (button) button.disabled = true;

        showToast("ZOVI is preparing your quiz...");

        const { data: { user }, error: authError } =
            await zoviSupabase.auth.getUser();

        if (authError || !user) {
            throw new Error("Please log in again.");
        }

        const { data: materials, error: materialError } =
            await zoviSupabase
                .from("materials")
                .select("file_name, extracted_text")
                .eq("subject_id", currentSubjectId)
                .not("extracted_text", "is", null);

        if (materialError) throw materialError;

        const materialContext = (materials || [])
            .map(file =>
                `FILE: ${file.file_name}\n${file.extracted_text || ""}`
            )
            .join("\n\n")
            .slice(0, 25000);

        if (!materialContext.trim()) {
            throw new Error(
                "Upload study material with extractable text first."
            );
        }

        const response = await fetch(
            `${API_BASE_URL}/api/ai/ask`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    subjectName: document.getElementById(
                        "workspaceSubjectName"
                    )?.textContent || "General",
                    materialContext,
                    question: `
Create a 10-question multiple-choice practice quiz
using ONLY the supplied study material.

Return ONLY a valid JSON array in this format:
[
  {
    "question": "Question text",
    "options": {
      "A": "Option one",
      "B": "Option two",
      "C": "Option three",
      "D": "Option four"
    },
    "answer": "A",
    "explanation": "Brief explanation based on the material"
  }
]

Requirements:
- Exactly 10 questions.
- Four options per question.
- Exactly one correct answer per question.
- Mix easy and moderate difficulty.
- Avoid duplicate questions.
- Do not add markdown or text outside the JSON array.
`
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || "Quiz generation failed."
            );
        }

        const rawAnswer = result.answer;

        if (typeof rawAnswer !== "string" || !rawAnswer.trim()) {
            throw new Error("ZOVI returned an empty quiz response.");
        }

        const cleanedAnswer = rawAnswer
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const start = cleanedAnswer.indexOf("[");
        const end = cleanedAnswer.lastIndexOf("]");

        if (start === -1 || end === -1 || end < start) {
            console.error(
                "Quiz response was not a JSON array:",
                rawAnswer
            );

            throw new Error(
                "ZOVI could not format the quiz correctly. Please try again."
            );
        }

        let questions;

        try {
            questions = JSON.parse(
                cleanedAnswer.slice(start, end + 1)
            );
        } catch (parseError) {
            console.error(
                "Quiz JSON parsing failed:",
                parseError,
                rawAnswer
            );

            throw new Error(
                "The generated quiz was incomplete or incorrectly formatted. Please try again."
            );
        }

        if (!Array.isArray(questions)) {
            throw new Error(
                "ZOVI did not return a valid list of questions."
            );
        }

        const validQuestions = questions.filter(q =>
            q &&
            typeof q.question === "string" &&
            q.options &&
            ["A", "B", "C", "D"].every(
                key => typeof q.options[key] === "string"
            ) &&
            ["A", "B", "C", "D"].includes(q.answer)
        );

        if (validQuestions.length !== 10) {
            console.error("Invalid quiz questions:", questions);

            throw new Error(
                `ZOVI generated ${validQuestions.length} valid questions instead of 10. Please try again.`
            );
        }

        const { error: saveError } = await zoviSupabase
            .from("quizzes")
            .insert({
                user_id: user.id,
                subject_id: currentSubjectId,
                title: "Practice Quiz",
                questions: validQuestions
            });

        if (saveError) throw saveError;

        showToast("Your quiz has been created successfully!");

        await renderSubjectQuizzes();

    } catch (error) {
        console.error("Quiz generation error:", error);
        showToast(error.message || "Could not generate quiz.");
    } finally {
        if (button) button.disabled = false;
    }
}

async function renderSubjectQuizzes() {
    const container = document.getElementById("subjectQuizzes");

    if (!container || !currentSubjectId) return;

    container.innerHTML = "<p>Loading quizzes...</p>";

    const { data: quizzes, error } = await zoviSupabase
        .from("quizzes")
        .select("*")
        .eq("subject_id", currentSubjectId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (error) {
        console.error("Quiz loading error:", error);
        container.innerHTML = "<p>Could not load quizzes.</p>";
        return;
    }

    if (!quizzes || !quizzes.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h4>No quizzes yet</h4>
                <p>Generate a quiz from your uploaded study materials.</p>
            </div>
        `;
        return;
    }

    const quiz = quizzes[0];

    container.innerHTML = `
        <div class="quiz-header">
            <h3>${DOMPurify.sanitize(quiz.title)}</h3>
            <p>${quiz.questions.length} questions</p>
        </div>

        <form data-quiz-form="${quiz.id}">
            ${quiz.questions.map((q, index) => `
                <article class="quiz-question">
                    <h4>${index + 1}. ${DOMPurify.sanitize(q.question)}</h4>

                    <div class="quiz-options">
                        ${["A", "B", "C", "D"].map(option => `
                            <label class="quiz-option">
                                <input
                                    type="radio"
                                    name="question-${index}"
                                    value="${option}"
                                >
                                <span>
                                    ${option}. ${DOMPurify.sanitize(q.options[option])}
                                </span>
                            </label>
                        `).join("")}
                    </div>

                    <div class="quiz-explanation" hidden>
                        <p><strong>Correct answer:</strong> ${q.answer}</p>
                        <p>${DOMPurify.sanitize(q.explanation || "No explanation provided.")}</p>
                    </div>
                </article>
            `).join("")}

            <button type="submit" class="primary-button">
                Submit Quiz
            </button>

            <div class="quiz-result" hidden></div>
        </form>
    `;
}

async function renderSubjectProgress() {
    const container = document.getElementById("subjectProgress");
    if (!container || !currentSubjectId) return;

    container.innerHTML = `<p>Loading your progress...</p>`;

    const { data: { user }, error: authError } =
        await window.zoviSupabase.auth.getUser();

    if (authError || !user) {
        container.innerHTML = `<p>Please log in to view your progress.</p>`;
        return;
    }

    const { data: attempts, error } = await window.zoviSupabase
        .from("quiz_attempts")
        .select("score, total_questions, attempted_at")
        .eq("user_id", user.id)
        .eq("subject_id", currentSubjectId)
        .order("attempted_at", { ascending: false });

    if (error) {
        console.error("Progress loading error:", error);
        container.innerHTML = `<p>Could not load your progress.</p>`;
        return;
    }

    if (!attempts || attempts.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <h3>Your learning journey starts here!</h3>
                <p>Complete your first quiz to see your progress.</p>
            </div>
        `;
        return;
    }

    // Calculate progress BEFORE rendering the dashboard
    const totalAttempts = attempts.length;

    const percentages = attempts.map(attempt =>
        attempt.total_questions > 0
            ? (attempt.score / attempt.total_questions) * 100
            : 0
    );

    const averageScore = Math.round(
        percentages.reduce((sum, value) => sum + value, 0) /
        totalAttempts
    );

    const bestScore = Math.round(Math.max(...percentages));
    const latestScore = Math.round(percentages[0]);

    // Render the dashboard
    container.innerHTML = `
        <div class="progress-dashboard">

            <div class="progress-stats">
                <div class="progress-stat-card">
                    <span>Quizzes Attempted</span>
                    <h2>${totalAttempts}</h2>
                    <small>Completed attempts</small>
                </div>

                <div class="progress-stat-card">
                    <span>Average Score</span>
                    <h2>${averageScore}%</h2>
                    <small>Across all attempts</small>
                </div>

                <div class="progress-stat-card">
                    <span>Best Score</span>
                    <h2>${bestScore}%</h2>
                    <small>Your personal best</small>
                </div>

                <div class="progress-stat-card">
                    <span>Latest Score</span>
                    <h2>${latestScore}%</h2>
                    <small>Most recent attempt</small>
                </div>
            </div>

            <div class="progress-chart-card">
                <div class="progress-card-heading">
                    <div>
                        <h3>Quiz Performance</h3>
                        <p>Track how your scores change over time.</p>
                    </div>
                    <span class="progress-chart-label">Last 10 attempts</span>
                </div>

                <div class="progress-chart">
                    ${attempts.slice(0, 10).reverse().map((attempt, index) => {
                        const percentage = Math.round(
                            (attempt.score / attempt.total_questions) * 100
                        );

                        return `
                            <div class="progress-bar-column">
                                <span class="progress-bar-value">${percentage}%</span>
                                <div class="progress-bar-track">
                                    <div
                                        class="progress-bar-fill"
                                        style="height: ${percentage}%">
                                    </div>
                                </div>
                                <span class="progress-bar-label">${index + 1}</span>
                            </div>
                        `;
                    }).join("")}
                </div>

                <div class="progress-chart-footer">
                    <span>Earlier attempts</span>
                    <span>Latest attempts →</span>
                </div>
            </div>

            <div class="progress-average-card">
                <div class="progress-card-heading">
                    <div>
                        <h3>Overall Performance</h3>
                        <p>Your average score across completed quizzes.</p>
                    </div>
                    <strong>${averageScore}%</strong>
                </div>

                <div class="overall-progress-track">
                    <div
                        class="overall-progress-fill"
                        style="width: ${averageScore}%">
                    </div>
                </div>
            </div>

            <div class="progress-history-card">
                <h3>Recent Quiz Attempts</h3>
                <p>Your latest learning activity.</p>

                <div class="progress-history">
                    ${attempts.slice(0, 10).map((attempt, index) => {
                        const percentage = Math.round(percentages[index]);

                        return `
                            <div class="progress-history-item">
                                <div>
                                    <strong>Practice Quiz</strong>
                                    <p>${new Date(attempt.attempted_at).toLocaleDateString()}</p>
                                </div>

                                <div class="progress-history-score">
                                    <strong>${attempt.score}/${attempt.total_questions}</strong>
                                    <span>${percentage}%</span>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>

        </div>
    `;
}
async function renderOverallProgress() {
    const container = document.getElementById("overallProgress");
    if (!container) return;

    container.innerHTML = "<p>Loading your overall progress...</p>";

    const { data: { user }, error: authError } =
        await window.zoviSupabase.auth.getUser();

    if (authError || !user) {
        container.innerHTML = "<p>Please log in to view your progress.</p>";
        return;
    }

    const { data: attempts, error } = await window.zoviSupabase
        .from("quiz_attempts")
        .select("score, total_questions, attempted_at, subject_id")
        .eq("user_id", user.id)
        .order("attempted_at", { ascending: false });

    if (error) {
        console.error("Overall progress loading error:", error);
        container.innerHTML = "<p>Could not load your overall progress.</p>";
        return;
    }

    if (!attempts || attempts.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <h3>Your learning journey starts here!</h3>
                <p>Complete a quiz in any subject to see your overall progress.</p>
            </div>
        `;
        return;
    }

    const percentages = attempts.map(attempt =>
        attempt.total_questions > 0
            ? (attempt.score / attempt.total_questions) * 100
            : 0
    );

    const averageScore = Math.round(
        percentages.reduce((sum, value) => sum + value, 0) /
        percentages.length
    );

    const bestScore = Math.round(Math.max(...percentages));
    const latestScore = Math.round(percentages[0]);

    const subjectNames = {};
    subjects.forEach(subject => {
        subjectNames[subject.id] = subject.name;
    });

    container.innerHTML = `
        <div class="progress-dashboard">
            <div class="progress-stats">
                <div class="progress-stat-card">
                    <span>Quizzes Attempted</span>
                    <h2>${attempts.length}</h2>
                    <small>Across all subjects</small>
                </div>

                <div class="progress-stat-card">
                    <span>Average Score</span>
                    <h2>${averageScore}%</h2>
                    <small>Across all attempts</small>
                </div>

                <div class="progress-stat-card">
                    <span>Best Score</span>
                    <h2>${bestScore}%</h2>
                    <small>Your personal best</small>
                </div>

                <div class="progress-stat-card">
                    <span>Latest Score</span>
                    <h2>${latestScore}%</h2>
                    <small>Most recent attempt</small>
                </div>
            </div>

            <div class="progress-average-card">
                <div class="progress-card-heading">
                    <div>
                        <h3>Overall Performance</h3>
                        <p>Your average across all completed quizzes.</p>
                    </div>
                    <strong>${averageScore}%</strong>
                </div>

                <div class="overall-progress-track">
                    <div class="overall-progress-fill"
                         style="width: ${averageScore}%"></div>
                </div>
            </div>

            <div class="progress-chart-card">
                <div class="progress-card-heading">
                    <div>
                        <h3>Quiz Performance</h3>
                        <p>Your latest scores across all subjects.</p>
                    </div>
                    <span class="progress-chart-label">Last 10 attempts</span>
                </div>

                <div class="progress-chart">
                    ${attempts.slice(0, 10).reverse().map((attempt, index) => {
                        const percentage = Math.round(
                            (attempt.score / attempt.total_questions) * 100
                        );

                        return `
                            <div class="progress-bar-column">
                                <span class="progress-bar-value">${percentage}%</span>
                                <div class="progress-bar-track">
                                    <div class="progress-bar-fill"
                                         style="height: ${percentage}%"></div>
                                </div>
                                <span class="progress-bar-label">${index + 1}</span>
                            </div>
                        `;
                    }).join("")}
                </div>
            </div>

            <div class="progress-history-card">
                <h3>Recent Quiz Attempts</h3>

                ${attempts.slice(0, 10).map(attempt => {
                    const percentage = Math.round(
                        (attempt.score / attempt.total_questions) * 100
                    );

                    return `
                        <div class="progress-history-item">
                            <div>
                                <strong>
                                    ${subjectNames[attempt.subject_id] || "Subject"}
                                </strong>
                                <small>
                                    ${new Date(attempt.attempted_at).toLocaleDateString()}
                                </small>
                            </div>

                            <span>
                                ${attempt.score}/${attempt.total_questions}
                                (${percentage}%)
                            </span>
                        </div>
                    `;
                }).join("")}
            </div>
        </div>
    `;
}

document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-quiz-form]");
    if (!form) return;

    event.preventDefault();

    const questions = form.querySelectorAll(".quiz-question");
    let score = 0;

    for (let i = 0; i < questions.length; i++) {
        const selected = form.querySelector(
            `input[name="question-${i}"]:checked`
        );

        if (!selected) {
            showToast("Please answer every question first.");
            return;
        }

        const correctAnswer = questions[i]
            .querySelector(".quiz-explanation")
            .querySelector("p")
            .textContent
            .replace("Correct answer:", "")
            .trim();

        if (selected.value === correctAnswer) {
            score++;
        }

        questions[i].querySelector(".quiz-explanation").hidden = false;
    }

    // Save the quiz attempt in Supabase.
    const { data: { user }, error: authError } =
        await window.zoviSupabase.auth.getUser();

    if (authError || !user) {
        showToast("Please log in again to save your progress.");
        return;
    }

    const quizId = form.dataset.quizForm;

    const { error: saveError } = await window.zoviSupabase
        .from("quiz_attempts")
        .insert({
            user_id: user.id,
            subject_id: currentSubjectId,
            quiz_id: quizId,
            score: score,
            total_questions: questions.length
        });

    if (saveError) {
        console.error("Quiz progress save error:", saveError);
        showToast("Your score could not be saved. Please try again.");
        return;
    }

    // Display the result.
    const result = form.querySelector(".quiz-result");
    result.hidden = false;
    result.innerHTML = `
        <h3>Your Score: ${score} / ${questions.length}</h3>
        <p>${Math.round(score / questions.length * 100)}% correct</p>
    `;

    form.querySelectorAll("input").forEach(input => {
        input.disabled = true;
    });

    form.querySelector('button[type="submit"]').disabled = true;
await renderSubjectProgress();
    showToast("Quiz result saved successfully!");
    await renderOverallProgress();
});

    
async function generateFlashcards() {
    if (!currentSubjectId) {
        showToast("Please open a subject first.");
        return;
    }

    const button = document.querySelector(
        '[data-action="generate-flashcards"]'
    );

    try {
        if (button) button.disabled = true;

        showToast("ZOVI is preparing your flashcards...");

        // Get the logged-in student.
        const { data: { user }, error: authError } =
            await zoviSupabase.auth.getUser();

        if (authError || !user) {
            throw new Error("Please log in again.");
        }

        // Get this subject's uploaded study materials.
        const { data: materials, error: materialError } =
            await zoviSupabase
                .from("materials")
                .select("file_name, extracted_text")
                .eq("subject_id", currentSubjectId)
                .not("extracted_text", "is", null);

        if (materialError) throw materialError;

        const materialContext = (materials || [])
            .map(file =>
                `FILE: ${file.file_name}\n${file.extracted_text || ""}`
            )
            .join("\n\n")
            .slice(0, 25000);

        if (!materialContext.trim()) {
            throw new Error(
                "Upload study material with extractable text first."
            );
        }

        // Ask ZOVI AI to generate structured flashcards.
        const response = await fetch(
            `${API_BASE_URL}/api/ai/ask`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    subjectName: document.getElementById(
                        "workspaceSubjectName"
                    ).textContent,
                    materialContext,
                    question: `
Create 15 useful study flashcards from the supplied material.

Return ONLY a valid JSON array.
Each item must have:
{
  "question": "A clear question",
  "answer": "A concise, accurate answer"
}

Cover different major topics. Use simple student-friendly language.
Do not add markdown or explanations outside the JSON array.
`
                })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "AI generation failed.");
        }

        // Extract the JSON array.
        const rawAnswer = result.answer
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        const start = rawAnswer.indexOf("[");
        const end = rawAnswer.lastIndexOf("]");

        if (start === -1 || end === -1) {
            throw new Error("ZOVI returned an invalid flashcard format.");
        }

        const cards = JSON.parse(
            rawAnswer.slice(start, end + 1)
        );

        const validCards = cards.filter(card =>
            typeof card.question === "string" &&
            typeof card.answer === "string" &&
            card.question.trim() &&
            card.answer.trim()
        );

        if (!validCards.length) {
            throw new Error("No valid flashcards were generated.");
        }

        // Save cards under the logged-in student and subject.
        const rows = validCards.map(card => ({
            user_id: user.id,
            subject_id: currentSubjectId,
            question: card.question.trim(),
            answer: card.answer.trim()
        }));

        const { error: saveError } = await zoviSupabase
            .from("flashcards")
            .insert(rows);

        if (saveError) throw saveError;

        await renderSubjectFlashcards();

        showToast(`${rows.length} flashcards created successfully!`);

    } catch (error) {
        console.error("Flashcard generation error:", error);
        showToast(error.message || "Could not generate flashcards.");
    } finally {
        if (button) button.disabled = false;
    }
}

async function renderSubjectFlashcards() {
    const container = document.getElementById("subjectFlashcards");
    if (!container || !currentSubjectId) return;

    container.innerHTML = "<p>Loading flashcards...</p>";

    const { data: cards, error } = await zoviSupabase
        .from("flashcards")
        .select("*")
        .eq("subject_id", currentSubjectId)
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        container.innerHTML = "<p>Could not load flashcards.</p>";
        return;
    }

    if (!cards || !cards.length) {
        container.innerHTML = `
            <div class="empty-state">
                <h4>No flashcards yet</h4>
                <p>Generate flashcards from your uploaded study materials.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = cards.map((card, index) => `
        <article class="zovi-flashcard">
            <div class="flashcard-number">CARD ${index + 1}</div>
            <div class="flashcard-question">
                ${DOMPurify.sanitize(card.question)}
            </div>

            <div class="flashcard-answer" hidden>
                ${DOMPurify.sanitize(card.answer)}
            </div>

            <button type="button"
                class="flashcard-flip-button"
                data-flip-card="${card.id}">
                Reveal answer
            </button>
        </article>
    `).join("");
}

document.addEventListener("click", event => {
    const button = event.target.closest("[data-flip-card]");
    if (!button) return;

    const card = button.closest(".zovi-flashcard");
    const answer = card.querySelector(".flashcard-answer");

    answer.hidden = !answer.hidden;
    button.textContent = answer.hidden
        ? "Reveal answer"
        : "Hide answer";
});



/* 17. EVENT LISTENERS */

document.addEventListener("click", event => {
        const deleteButton =
        event.target.closest("#deleteSubjectButton");

    if (deleteButton) {
        if (currentSubjectId) {
            deleteSubject(currentSubjectId);
        }
        return;
    }
    const deleteMaterialButton =
    event.target.closest("[data-delete-material]");

if (deleteMaterialButton) {
    deleteMaterial(deleteMaterialButton.dataset.deleteMaterial);
    return;
}
const downloadMaterialButton =
    event.target.closest("[data-download-material]");

if (downloadMaterialButton) {
    downloadMaterial(downloadMaterialButton.dataset.downloadMaterial);
    return;
}
    const navigationButton =
        event.target.closest("[data-view]");

    if (navigationButton) {
        navigateToPage(navigationButton.dataset.view);
        return;
    }

    const actionButton =
        event.target.closest("[data-action]");

    if (actionButton) {
        handleAction(actionButton.dataset.action);
        return;
    }

    const subjectCard =
        event.target.closest("[data-subject-id]");

    if (subjectCard) {
        openSubjectWorkspace(subjectCard.dataset.subjectId);
        return;
    }

    const workspaceTab =
        event.target.closest("[data-workspace-tab]");

    if (workspaceTab) {
        showWorkspaceTab(workspaceTab.dataset.workspaceTab);
    }
});

// CHAT FILE ATTACHMENT LISTENERS

document.addEventListener("click", event => {
    const attachButton = event.target.closest("[data-attach-input]");
    if (!attachButton) return;

    const input = document.getElementById(
        attachButton.dataset.attachInput
    );

    if (input) input.click();
});

document.getElementById("chatFileInput").addEventListener(
    "change",
    event => {
        handleChatFileSelection("chatInput", event.target.files);
        event.target.value = "";
    }
);

document.getElementById("globalChatFileInput").addEventListener(
    "change",
    event => {
        handleChatFileSelection("globalChatInput", event.target.files);
        event.target.value = "";
    }
);
/* 18. FORM LISTENERS */

document.getElementById("subjectForm").addEventListener(
    "submit",
    createSubject
);

document.getElementById("uploadForm").addEventListener(
    "submit",
    handleMaterialSelection
);

document.getElementById("chatForm").addEventListener(
    "submit",
    event => {
        handleChat(
            event,
            "chatInput",
            "chatMessages"
        );
    }
);
document.getElementById("newSubjectChat").addEventListener("click", async () => {
    try {
        await createConversation();
        document.getElementById("chatInput").focus();
    } catch (error) {
        console.error("New chat error:", error);
        alert("Could not create a new chat. Please try again.");
    }
});

document.getElementById("globalChatForm").addEventListener(
    "submit",
    event => {
        handleChat(
            event,
            "globalChatInput",
            "globalChatMessages"
        );
    }
);


/* 19. MOBILE MENU LISTENER */

document.getElementById("menuToggle").addEventListener(
    "click",
    toggleSidebar
);

/* 20. INITIALISE ZOVI */

async function initializeZoviForUser(session) {
    if (!session?.user) {
        initializedUserId = null;
        currentUserId = null;
        currentSubjectId = null;
        currentWorkspaceTab = "materials";
        subjects = [];
        renderSubjects();
        return;
    }

    const userId = session.user.id;

    // Avoid loading the same account twice.
    if (initializedUserId === userId) return;

    initializedUserId = userId;
    currentUserId = userId;

    await loadSubjects();
    restoreNavigationState();

    console.log("ZOVI application initialised for:", userId);
}

window.addEventListener("zovi-auth-ready", event => {
    initializeZoviForUser(event.detail.session);
});

window.addEventListener("zovi-auth-changed", event => {
    initializeZoviForUser(event.detail.session);
});

document.addEventListener("DOMContentLoaded", () => {
    testBackendConnection();
    console.log("Waiting for ZOVI authentication...");
});
async function deleteSubject(subjectId) {
    const subject = subjects.find(
        item => item.id === subjectId
    );

    if (!subject) return;

    const confirmed = confirm(
        `Are you sure you want to delete "${subject.name}"?\n\nThis will permanently delete its chapters and uploaded study materials too.`
    );

    if (!confirmed) return;

    try {
        showToast("Deleting subject...");

        // Find all uploaded materials belonging to this subject.
        const { data: materials, error: materialsError } =
            await window.zoviSupabase
                .from("materials")
                .select("storage_path")
                .eq("subject_id", subjectId);

        if (materialsError) throw materialsError;

        // Delete actual files from private Storage.
        const storagePaths = (materials || [])
            .map(item => item.storage_path)
            .filter(Boolean);

        if (storagePaths.length > 0) {
            const { error: storageError } =
                await window.zoviSupabase
                    .storage
                    .from("study-materials")
                    .remove(storagePaths);

            if (storageError) throw storageError;
        }

        // Delete material records.
        const { error: deleteMaterialsError } =
            await window.zoviSupabase
                .from("materials")
                .delete()
                .eq("subject_id", subjectId);

        if (deleteMaterialsError) throw deleteMaterialsError;

        // Delete chapters.
        const { error: deleteChaptersError } =
            await window.zoviSupabase
                .from("chapters")
                .delete()
                .eq("subject_id", subjectId);

        if (deleteChaptersError) throw deleteChaptersError;

        // Finally, delete the subject.
        const { error: deleteSubjectError } =
            await window.zoviSupabase
                .from("subjects")
                .delete()
                .eq("id", subjectId);

        if (deleteSubjectError) throw deleteSubjectError;

        subjects = subjects.filter(
            item => item.id !== subjectId
        );

        currentSubjectId = null;

        renderSubjects();
        navigateToPage("subjects");

        showToast("Subject and its study materials deleted.");

    } catch (error) {
        console.error("Subject deletion failed:", error);
        showToast(error.message || "Could not delete subject.");
    }
}
// ZOVI Voice Mode - Speech Recognition

const voiceModeButton = document.getElementById("voiceModeButton");
const voiceModeOverlay = document.getElementById("voiceModeOverlay");
const closeVoiceMode = document.getElementById("closeVoiceMode");
const voiceStartButton = document.getElementById("voiceStartButton");
const voiceStopButton = document.getElementById("voiceStopButton");
const voiceStatus = document.getElementById("voiceStatus");
const voiceAnimation = document.getElementById("voiceAnimation");

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let zoviRecognition = null;

if (voiceModeButton && voiceModeOverlay) {

    voiceModeButton.addEventListener("click", () => {
        voiceModeOverlay.hidden = false;
    });

    function closeVoiceScreen() {
        if (zoviRecognition) {
            zoviRecognition.stop();
        }
        window.speechSynthesis.cancel();
        voiceModeOverlay.hidden = true;
        voiceAnimation.classList.remove("active");
        voiceStartButton.hidden = false;
        voiceStopButton.hidden = true;
        voiceStatus.textContent = "Ready when you are...";
    }

    closeVoiceMode.addEventListener("click", closeVoiceScreen);

    voiceModeOverlay.addEventListener("click", (event) => {
        if (event.target === voiceModeOverlay) {
            closeVoiceScreen();
        }
    });

    voiceStartButton.addEventListener("click", () => {

        if (!SpeechRecognition) {
            voiceStatus.textContent =
                "Speech recognition is not supported in this browser.";
            return;
        }

        zoviRecognition = new SpeechRecognition();

        zoviRecognition.lang = "en-IN";
        zoviRecognition.continuous = false;
        zoviRecognition.interimResults = false;

        zoviRecognition.onstart = () => {
            voiceStatus.textContent = "Listening... Speak to ZOVI";
            voiceStartButton.hidden = true;
            voiceStopButton.hidden = false;
            voiceAnimation.classList.add("active");
        };

        zoviRecognition.onresult = (event) => {
            const spokenText = event.results[0][0].transcript;

            voiceStatus.textContent = "Sending your question to ZOVI...";

            const chatInput = document.getElementById("chatInput");
            const chatForm = document.getElementById("chatForm");

            if (chatInput && chatForm) {
                chatInput.value = spokenText;
                chatForm.requestSubmit();
            } else {
                voiceStatus.textContent = "Could not find the subject chat.";
            }
        };

        zoviRecognition.onerror = (event) => {
            voiceStatus.textContent =
                "Microphone issue: " + event.error;
        };

        zoviRecognition.onend = () => {
            voiceAnimation.classList.remove("active");
            voiceStartButton.hidden = false;
            voiceStopButton.hidden = true;

            if (voiceStatus.textContent === "Listening... Speak to ZOVI") {
                voiceStatus.textContent = "Didn't catch that. Try again.";
            }
        };

        zoviRecognition.start();
    });

    voiceStopButton.addEventListener("click", () => {
        if (zoviRecognition) {
            zoviRecognition.stop();
        }
    });
}
// ZOVI - Warm voice selection

function getZoviVoice() {
    const voices = window.speechSynthesis.getVoices();

    const englishVoices = voices.filter(voice =>
        voice.lang.toLowerCase().startsWith("en")
    );

    // Prefer commonly available male-sounding English voices.
    const maleVoice = englishVoices.find(voice =>
        /david|mark|guy|james|daniel|male/i.test(voice.name)
    );

    // Prefer a natural-sounding English voice if no male voice is found.
    return maleVoice ||
        englishVoices.find(voice =>
            /natural|neural|google|microsoft/i.test(voice.name)
        ) ||
        englishVoices[0] ||
        null;
}

// Refresh voice list when the browser loads its available voices.
window.speechSynthesis.onvoiceschanged = getZoviVoice;