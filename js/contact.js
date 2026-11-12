
/*
 * Sustainable Work Lab
 * Contact Lab Page
 *
 * Handles:
 * - Loading Contact information from the shared Google Sheets backend
 * - Editing contact information
 * - Editing the director biography and CV link
 * - Adding, editing, and deleting collaborators
 */

var CONTACT_API_URL =
    "https://script.google.com/macros/s/AKfycbxXWepgx7V36_813pDWuXotL_iN09QpBqdroovIylZ4msOhwJbQHkeRgWCBI-pjvhSTtg/exec?sheet=Contact";

var contactSettings = {};
var contactPeople = [];
var contactEditMode = false;
var contactDataReady = false;


/*
 * Start the Contact page.
 */
document.addEventListener("DOMContentLoaded", function () {
    injectEditControls();
    loadContactData();
});


/*
 * Add Edit Mode and Save buttons.
 */
function injectEditControls() {
    var pageHead = document.querySelector(".page-head");

    if (!pageHead) return;

    var editButton = document.createElement("button");
    editButton.type = "button";
    editButton.id = "contact-edit-toggle";
    editButton.className = "btn btn-light";
    editButton.textContent = "Edit Mode: OFF";
    editButton.style.marginTop = "10px";

    editButton.addEventListener("click", function () {
        if (!contactDataReady) {
            showContactMessage(
                "Contact editing is unavailable because the Contact data has not loaded correctly."
            );
            return;
        }

        contactEditMode = !contactEditMode;

        editButton.textContent = contactEditMode
            ? "Edit Mode: ON"
            : "Edit Mode: OFF";

        if (contactEditMode) {
            editButton.style.backgroundColor = "#ffc107";
            editButton.style.color = "#000";
        } else {
            editButton.style.backgroundColor = "";
            editButton.style.color = "";
        }

        renderContactPage();
    });

    pageHead.appendChild(editButton);

    var saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.id = "contact-save-button";
    saveButton.className = "btn";
    saveButton.textContent = "Save Changes";
    saveButton.style.marginLeft = "10px";
    saveButton.style.marginTop = "10px";
    saveButton.hidden = true;
    saveButton.style.display = "none";

    saveButton.addEventListener("click", saveContactChanges);

    pageHead.appendChild(saveButton);

    var peopleSection = document.querySelector(
        '.block[aria-labelledby="people-h"]'
    );

    if (peopleSection) {
        var addButton = document.createElement("button");
        addButton.type = "button";
        addButton.id = "add-person-button";
        addButton.className = "btn btn-light";
        addButton.textContent = "Add Person";
        addButton.style.marginBottom = "15px";
        addButton.hidden = true;
        addButton.style.display = "none";

        addButton.addEventListener("click", addPerson);

        var heading = peopleSection.querySelector("h2");

        if (heading) {
            heading.insertAdjacentElement("afterend", addButton);
        }
    }
}


/*
 * Load Contact information from the shared Google Sheets backend.
 */
async function loadContactData() {
    try {
        var response = await fetch(CONTACT_API_URL);

        if (!response.ok) {
            throw new Error("Unable to load Contact information.");
        }

        var data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error(data.error || "Invalid Contact data.");
        }

        if (data.length && !data.some(function (entry) {
            return entry.type === "setting" || entry.type === "person";
        })) {
            throw new Error(
                "The Apps Script endpoint returned non-Contact rows. Deploy the version that routes ?sheet=Contact before editing."
            );
        }

        contactSettings = {};
        contactPeople = [];

        data.forEach(function (entry) {
            if (entry.type === "setting") {
                contactSettings[entry.id] = entry.value || "";
            }

            if (entry.type === "person") {
                contactPeople.push(entry);
            }
        });

        contactPeople.sort(function (a, b) {
            return (Number(a.order) || 0) - (Number(b.order) || 0);
        });

        contactDataReady = true;
        renderContactPage();
        return true;

    } catch (error) {
        contactDataReady = false;
        console.error("Contact page error:", error);
        showContactMessage("Could not load Contact information: " + error.message);
        return false;
    }
}


/*
 * Display the information on the page.
 */
function renderContactPage() {
    renderSettings();
    renderPeople();

    var saveButton = document.getElementById("contact-save-button");
    var addButton = document.getElementById("add-person-button");

    if (saveButton) {
        saveButton.hidden = !contactEditMode;
        saveButton.style.display = contactEditMode ? "" : "none";
    }

    if (addButton) {
        addButton.hidden = !contactEditMode;
        addButton.style.display = contactEditMode ? "" : "none";
    }
}


/*
 * Display contact settings.
 */
function renderSettings() {
    var details = document.querySelectorAll(".card.ways dl dd");

    var settingFields = [
        "email",
        "office",
        "office_hours"
    ];

    settingFields.forEach(function (setting, index) {
        if (!details[index]) return;

        var value = contactSettings[setting];

        if (value === undefined || value === "") {
            value = details[index].dataset.originalValue ||
                details[index].textContent;
        }

        details[index].dataset.originalValue = value;

        if (contactEditMode) {
            var input = document.createElement("input");
            input.type = "text";
            input.dataset.setting = setting;
            input.value = value;
            input.style.width = "100%";

            details[index].replaceChildren(input);
        } else {
            details[index].textContent = value;
        }
    });

    var biography = document.querySelector(".card.about p");

    if (biography) {
        var biographyValue = contactSettings.biography;

        if (biographyValue === undefined || biographyValue === "") {
            biographyValue = biography.dataset.originalValue ||
                biography.textContent;
        }

        biography.dataset.originalValue = biographyValue;

        if (contactEditMode) {
            var textarea = document.createElement("textarea");
            textarea.dataset.setting = "biography";
            textarea.value = biographyValue;
            textarea.rows = 6;
            textarea.style.width = "100%";

            biography.replaceChildren(textarea);
        } else {
            biography.textContent = biographyValue;
        }
    }

    var cvLink = document.querySelector(".card.about a.btn");

    if (cvLink) {
        var cvValue = contactSettings.cv_url || cvLink.dataset.originalHref || "";

        if (!cvLink.dataset.originalHref) {
            cvLink.dataset.originalHref = cvLink.getAttribute("href") || "";
        }

        if (contactEditMode) {
            var cvInput = document.createElement("input");
            cvInput.type = "url";
            cvInput.dataset.setting = "cv_url";
            cvInput.value = cvValue;
            cvInput.placeholder = "Enter Resume / CV URL";
            cvInput.style.width = "100%";

            cvLink.hidden = true;

            var existingInput = document.getElementById("cv-url-editor");

            if (!existingInput) {
                cvInput.id = "cv-url-editor";
                cvLink.insertAdjacentElement("afterend", cvInput);
            } else {
                existingInput.value = cvValue;
            }

        } else {
            cvLink.hidden = false;
            cvLink.href = cvValue || cvLink.dataset.originalHref || "#";

            var existingInput = document.getElementById("cv-url-editor");

            if (existingInput) {
                existingInput.remove();
            }
        }
    }
}


/*
 * Display collaborator entries.
 */
function renderPeople() {
    var peopleList = document.querySelector(".people");

    if (!peopleList) return;

    peopleList.replaceChildren();

    contactPeople.forEach(function (person) {
        var item = document.createElement("li");
        item.className = "person";
        item.dataset.id = person.id;

        var avatar = document.createElement("div");
        avatar.className = "avatar media-ph";

        if (person.photo) {
            var image = document.createElement("img");
            image.src = person.photo;
            image.alt = person.name || "Collaborator";
            image.style.width = "100%";
            image.style.height = "100%";
            image.style.objectFit = "cover";

            avatar.replaceChildren(image);
        } else {
            avatar.textContent = "Photo";
            avatar.setAttribute("role", "img");
            avatar.setAttribute("aria-label", "Photo placeholder");
        }

        var name = document.createElement("h3");
        name.textContent = person.name || "Name";

        var position = document.createElement("p");
        position.textContent = person.position || "Position";

        item.appendChild(avatar);
        item.appendChild(name);
        item.appendChild(position);

        if (contactEditMode) {
            var nameInput = document.createElement("input");
            nameInput.type = "text";
            nameInput.className = "person-name-input";
            nameInput.value = person.name || "";
            nameInput.placeholder = "Name";
            nameInput.style.width = "100%";

            var positionInput = document.createElement("input");
            positionInput.type = "text";
            positionInput.className = "person-position-input";
            positionInput.value = person.position || "";
            positionInput.placeholder = "Position";
            positionInput.style.width = "100%";

            var photoInput = document.createElement("input");
            photoInput.type = "url";
            photoInput.className = "person-photo-input";
            photoInput.value = person.photo || "";
            photoInput.placeholder = "Photo URL (optional)";
            photoInput.style.width = "100%";

            item.appendChild(nameInput);
            item.appendChild(positionInput);
            item.appendChild(photoInput);

            var deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "btn btn-light";
            deleteButton.textContent = "Remove";
            deleteButton.style.marginTop = "10px";

            deleteButton.addEventListener("click", function () {
                deletePerson(person.id);
            });

            item.appendChild(deleteButton);
        }

        peopleList.appendChild(item);
    });
}


/*
 * Send a request to the shared Google Sheets backend.
 */
async function sendContactRequest(payload) {
    if (!contactDataReady) {
        throw new Error(
            "Contact data is not loaded correctly. No changes were sent."
        );
    }

    var response = await fetch(CONTACT_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error("The server could not complete the request.");
    }

    var result = await response.json();

    if (!result.success) {
        throw new Error(result.error || "The request failed.");
    }

    return result;
}


/*
 * Save all edited settings and collaborator information.
 */
async function saveContactChanges() {
    var saveButton = document.getElementById("contact-save-button");

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        var updates = [];

        // Contact details
        document.querySelectorAll("[data-setting]").forEach(function (field) {
            var setting = field.dataset.setting;

            if (setting) {
                updates.push({
                    id: setting,
                    updated_data: {
                        value: field.value
                    }
                });
            }
        });

        // Collaborator information
        document.querySelectorAll(".person[data-id]").forEach(function (item) {
            updates.push({
                id: item.dataset.id,
                updated_data: {
                    name: item.querySelector(".person-name-input").value,
                    position: item.querySelector(".person-position-input").value,
                    photo: item.querySelector(".person-photo-input").value
                }
            });
        });

        for (var i = 0; i < updates.length; i++) {
            await sendContactRequest({
                action: "update",
                id: updates[i].id,
                updated_data: updates[i].updated_data
            });
        }

        contactEditMode = false;

        var editButton = document.getElementById("contact-edit-toggle");
        editButton.textContent = "Edit Mode: OFF";
        editButton.style.backgroundColor = "";
        editButton.style.color = "";

        if (!(await loadContactData())) {
            return;
        }

        showContactMessage("Contact information saved successfully.");

    } catch (error) {
        console.error("Save error:", error);
        showContactMessage("Could not save changes: " + error.message);

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
}


/*
 * Add a new collaborator.
 */
async function addPerson() {
    try {
        await sendContactRequest({
            action: "create"
        });

        if (!(await loadContactData())) {
            return;
        }

        showContactMessage(
            "New person added. You can now edit their information."
        );

    } catch (error) {
        console.error("Add person error:", error);
        showContactMessage("Could not add person: " + error.message);
    }
}


/*
 * Delete a collaborator.
 */
async function deletePerson(id) {
    if (!confirm("Are you sure you want to remove this person?")) {
        return;
    }

    try {
        await sendContactRequest({
            action: "delete",
            id: id
        });

        if (!(await loadContactData())) {
            return;
        }

        showContactMessage("Person removed successfully.");

    } catch (error) {
        console.error("Delete person error:", error);
        showContactMessage("Could not remove person: " + error.message);
    }
}


/*
 * Show a status message on the Contact page.
 */
function showContactMessage(message) {
    var status = document.getElementById("contact-edit-status");

    if (!status) {
        status = document.createElement("p");
        status.id = "contact-edit-status";
        status.setAttribute("role", "status");

        var pageHead = document.querySelector(".page-head");

        if (pageHead) {
            pageHead.appendChild(status);
        }
    }

    status.textContent = message;
}
