
const API_URL = "https://script.google.com/macros/s/AKfycby6vSWPWTubpRtfYicgx1xst5SDqqHh5z-EQfUP3rEeJxemsARszk7t0IAivt_aYCsj3Q/exec?sheet=Surveys";

document.addEventListener("DOMContentLoaded", function () {

    const labSurveyList = document.querySelector("#lab-h + .survey-list");
    const otherSurveyList = document.querySelector("#other-h + .survey-list");

    if (!labSurveyList || !otherSurveyList) {
        console.error("Survey lists could not be found.");
        return;
    }

    let surveys = [];
    let editMode = false;

    // Edit controls
    const controls = document.createElement("div");
    controls.className = "survey-controls";

    controls.innerHTML = `
        <button type="button" id="toggle-edit" class="btn btn-light">
            Edit Mode: OFF
        </button>
        <button type="button" id="add-survey" class="btn btn-light" hidden>
            Add Survey
        </button>
        <span id="survey-status" role="status"></span>
    `;

    const pageHeader = document.querySelector(".page-head");

    if (pageHeader) {
        pageHeader.appendChild(controls);
    }

    const toggleButton = document.getElementById("toggle-edit");
    const addButton = document.getElementById("add-survey");
    const statusMessage = document.getElementById("survey-status");

    if (!toggleButton || !addButton || !statusMessage) {
        console.error("Survey controls could not be found.");
        return;
    }

    function applySurveyButtonStyle(button, leftMargin) {
        if (!button) return;
        button.className = "btn btn-light";
        button.style.marginLeft = leftMargin;
        button.style.fontWeight = "700";
        button.style.borderRadius = "999px";
        button.style.borderWidth = "2px";
    }

    applySurveyButtonStyle(toggleButton, "15px");
    applySurveyButtonStyle(addButton, "10px");

    // Retrieve surveys from Google Sheets
    async function loadSurveys() {

        statusMessage.textContent = "Loading surveys...";

        try {

            const response = await fetch(API_URL);

            if (!response.ok) {
                throw new Error("Unable to retrieve surveys.");
            }

            const data = await response.json();

            if (!Array.isArray(data)) {
                throw new Error(data.error || "Invalid survey data.");
            }

            surveys = data.map(function (survey) {
                return {
                    id: String(survey.id),
                    title: survey.title || "",
                    url: survey.url || "",
                    section: survey.section || "Lab",
                    note: survey.note || "",
                    order: Number(survey.order) || 0
                };
            });

            renderSurveys();

            statusMessage.textContent = "";

        } catch (error) {

            console.error("Error loading surveys:", error);

            statusMessage.textContent = "Could not load surveys. Check the console for errors.";

        }
    }

    // Display surveys in their appropriate sections
    function renderSurveys() {

        labSurveyList.innerHTML = "";
        otherSurveyList.innerHTML = "";

        const sortedSurveys = [...surveys].sort(function (a, b) {
            if (a.section !== b.section) {
                return a.section.localeCompare(b.section);
            }

            return a.order - b.order;
        });

        sortedSurveys.forEach(function (survey) {

            const listItem = document.createElement("li");
            listItem.className = "survey-item";

            if (editMode) {
                listItem.appendChild(createEditForm(survey));
            } else {
                listItem.appendChild(createSurveyLink(survey));
            }

            if (survey.section.trim().toLowerCase() === "other") {
                otherSurveyList.appendChild(listItem);
            } else {
                labSurveyList.appendChild(listItem);
            }

        });
    }

    // Normal survey link
    function createSurveyLink(survey) {

        const link = document.createElement("a");

        link.className = "survey";
        link.href = survey.url || "#";
        link.target = "_blank";
        link.rel = "noopener";

        const title = document.createElement("span");
        title.className = "survey-title";
        title.textContent = survey.title;

        const note = document.createElement("span");
        note.className = "survey-note";
        note.textContent = survey.note;

        link.appendChild(title);
        link.appendChild(note);

        if (!survey.url) {
            link.addEventListener("click", function (event) {
                event.preventDefault();
            });
        }

        return link;
    }

    // Survey editing form
    function createEditForm(survey) {

        const container = document.createElement("div");
        container.className = "survey-editor";

        function createField(labelText, control) {
            const label = document.createElement("label");
            label.className = "survey-editor-field";
            label.style.display = "grid";

            const caption = document.createElement("span");
            caption.className = "survey-editor-label";
            caption.textContent = labelText;

            label.appendChild(caption);
            label.appendChild(control);

            return label;
        }

        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.placeholder = "Survey title";
        titleInput.value = survey.title;

        const urlInput = document.createElement("textarea");
        urlInput.rows = 2;
        urlInput.placeholder = "https://example.com";
        urlInput.value = survey.url;

        const sectionSelect = document.createElement("select");

        sectionSelect.innerHTML = `
            <option value="Lab">Lab surveys</option>
            <option value="Other">Other relevant surveys</option>
        `;

        sectionSelect.value = survey.section;

        const noteInput = document.createElement("textarea");
        noteInput.rows = 4;
        noteInput.placeholder = "Add a short description";
        noteInput.value = survey.note;

        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.className = "btn btn-light survey-save";
        saveButton.textContent = "Save";

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn survey-delete";
        deleteButton.textContent = "Delete";

        saveButton.addEventListener("click", async function () {

            const updatedData = {
                title: titleInput.value.trim(),
                url: urlInput.value.trim(),
                section: sectionSelect.value,
                note: noteInput.value.trim(),
                order: survey.order
            };

            if (!updatedData.title) {
                alert("Please enter a survey title.");
                return;
            }

            if (updatedData.url) {
                try {
                    const parsedURL = new URL(updatedData.url);

                    if (!["http:", "https:"].includes(parsedURL.protocol)) {
                        throw new Error();
                    }

                } catch (error) {
                    alert("Please enter a valid HTTP or HTTPS URL.");
                    return;
                }
            }

            await sendRequest({
                action: "update",
                id: survey.id,
                updated_data: updatedData
            });

        });

        deleteButton.addEventListener("click", async function () {

            if (!confirm("Are you sure you want to delete this survey?")) {
                return;
            }

            await sendRequest({
                action: "delete",
                id: survey.id
            });

        });

        const fields = document.createElement("div");
        fields.className = "survey-editor-fields";
        fields.style.display = "flex";
        fields.style.flexDirection = "column";
        fields.appendChild(createField("Survey title", titleInput));
        fields.appendChild(createField("Survey URL", urlInput));
        fields.appendChild(createField("Section", sectionSelect));
        fields.appendChild(createField("Description", noteInput));

        const actions = document.createElement("div");
        actions.className = "survey-editor-actions";
        actions.appendChild(saveButton);
        actions.appendChild(deleteButton);

        container.appendChild(fields);
        container.appendChild(actions);

        return container;
    }

    // Send updates to Google Apps Script
    async function sendRequest(payload) {

        statusMessage.textContent = "Saving changes...";

        try {

            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error("Server request failed.");
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || "Save failed.");
            }

            statusMessage.textContent = "Changes saved.";

            await loadSurveys();

        } catch (error) {

            console.error("Error saving survey:", error);

            statusMessage.textContent = "Could not save changes. Check the console.";

        }
    }

    // Add a new survey
    addButton.addEventListener("click", async function () {

        const section = prompt(
            "Which section should this survey go in? Enter Lab or Other.",
            "Lab"
        );

        if (section === null) return;

        const selectedSection = section.trim().toLowerCase();

        if (selectedSection !== "lab" && selectedSection !== "other") {
            alert("Please enter either Lab or Other.");
            return;
        }

        await sendRequest({
            action: "create",
            section: selectedSection === "other" ? "Other" : "Lab"
        });

    });

    // Toggle Edit Mode
    toggleButton.addEventListener("click", function () {

        editMode = !editMode;

        if (editMode) {
            toggleButton.textContent = "Edit Mode: ON";
            toggleButton.className = "btn btn-light";
            toggleButton.style.backgroundColor = "#ffc107";
            toggleButton.style.color = "#000";
            toggleButton.style.borderColor = "#ffc107";
        } else {
            toggleButton.textContent = "Edit Mode: OFF";
            toggleButton.className = "btn btn-light";
            toggleButton.style.backgroundColor = "";
            toggleButton.style.color = "";
            toggleButton.style.borderColor = "";
        }

        addButton.className = "btn btn-light";
        addButton.hidden = !editMode;

        renderSurveys();

    });

    // Initial load
    loadSurveys();

});