
/*
 * Sustainable Work Lab
 * Get Connected - Events
 *
 * Handles:
 * - Loading events from Google Sheets
 * - Displaying upcoming and past events
 * - Adding, editing, and deleting events
 * - Automatically sorting events by date and time
 */

(function () {
    var API_URL = "https://script.google.com/macros/s/AKfycby6vSWPWTubpRtfYicgx1xst5SDqqHh5z-EQfUP3rEeJxemsARszk7t0IAivt_aYCsj3Q/exec?sheet=Events";

    var events = [];
    var editMode = false;

    function el(tag, cls, text) {
        var element = document.createElement(tag);

        if (cls) {
            element.className = cls;
        }

        if (text !== undefined && text !== null) {
            element.textContent = text;
        }

        return element;
    }

    function addStyles() {
        if (document.getElementById("events-edit-styles")) return;

        var style = document.createElement("style");
        style.id = "events-edit-styles";

        style.textContent = `
            .events-toolbar {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin: 0 0 24px;
            }

            .events-status {
                margin: 10px 0;
                font-size: 0.9rem;
            }

            .event-editor {
                margin-top: 18px;
                padding: 16px;
                border: 1px solid #ccc;
                border-radius: 8px;
                background: #f7f7f7;
            }

            .event-editor label {
                display: block;
                margin: 10px 0 4px;
                font-weight: 600;
            }

            .event-editor input,
            .event-editor textarea,
            .event-editor select {
                box-sizing: border-box;
                width: 100%;
                padding: 9px;
                border: 1px solid #aaa;
                border-radius: 4px;
                font: inherit;
            }

            .event-editor textarea {
                min-height: 75px;
                resize: vertical;
            }

            .event-editor .event-checkbox {
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 12px 0;
            }

            .event-editor .event-checkbox input {
                width: auto;
            }

            .event-editor-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin-top: 16px;
            }

            .event-edit-button {
                margin-top: 12px;
            }

            .events-toolbar button,
            .event-editor-actions button,
            .event-edit-button {
                cursor: pointer;
            }
        `;

        document.head.appendChild(style);
    }

    function addToolbar() {
        var header = document.querySelector(".page-head");
        if (!header) return;

        var toolbar = el("div", "events-toolbar");

        var editButton = el("button", "btn btn-light", "Edit Mode: OFF");
        editButton.type = "button";
        editButton.id = "events-edit-toggle";
        editButton.style.marginLeft = "15px";

        editButton.addEventListener("click", function () {
            editMode = !editMode;

            editButton.textContent = editMode
                ? "Edit Mode: ON"
                : "Edit Mode: OFF";
            editButton.style.backgroundColor = editMode ? "#ffc107" : "";
            editButton.style.color = editMode ? "#000" : "";

            renderEvents();
        });

        var addButton = el("button", "btn btn-light", "Add Event");
        addButton.type = "button";
        addButton.id = "add-event-button";
        addButton.style.marginLeft = "10px";

        addButton.addEventListener("click", addEvent);
        addButton.hidden = true;
        addButton.style.display = "none";

        var status = el("p", "events-status");
        status.id = "events-status";
        status.setAttribute("role", "status");

        toolbar.appendChild(editButton);
        toolbar.appendChild(addButton);
        toolbar.appendChild(status);

        header.insertAdjacentElement("afterend", toolbar);

        document.addEventListener("events-edit-mode", function () {
            addButton.hidden = !editMode;
            addButton.style.display = editMode ? "" : "none";
        });
    }

    function setStatus(message) {
        var status = document.getElementById("events-status");
        if (status) status.textContent = message;
    }

    function parseDate(value) {
        if (!value) return null;

        var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));

        if (match) {
            return new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3])
            );
        }

        var fallback = new Date(value);
        return isNaN(fallback.getTime()) ? null : new Date(
            fallback.getFullYear(),
            fallback.getMonth(),
            fallback.getDate()
        );
    }

    function getEventDateTime(event) {
        var date = parseDate(event.date);

        if (!date) return null;

        if (event.time) {
            var timeMatch = /^(\d{1,2}):(\d{2})/.exec(String(event.time));

            if (timeMatch) {
                date.setHours(
                    Number(timeMatch[1]),
                    Number(timeMatch[2]),
                    0,
                    0
                );
                return date;
            }
        }

        // If no time is supplied, the event remains upcoming until the
        // end of its scheduled date.
        date.setHours(23, 59, 59, 999);
        return date;
    }

    function isSample(value) {
        return value === true ||
            String(value).toLowerCase() === "true";
    }

    function formatDate(date) {
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        });
    }

    function formatTime(time) {
        if (!time) return "";

        var match = /^(\d{1,2}):(\d{2})/.exec(String(time));
        if (!match) return String(time);

        var hours = Number(match[1]);
        var minutes = match[2];
        var suffix = hours >= 12 ? "PM" : "AM";
        var displayHour = hours % 12 || 12;

        return displayHour + ":" + minutes + " " + suffix;
    }

    function row(dl, label, value) {
        dl.appendChild(el("dt", "", label));
        dl.appendChild(el("dd", "", value));
    }

    function makeButton(label, className, callback) {
        var button = el("button", className, label);
        button.type = "button";
        button.addEventListener("click", callback);
        return button;
    }

    function makeField(container, labelText, name, value, type) {
        var label = el("label", "", labelText);
        var input;

        if (type === "textarea") {
            input = document.createElement("textarea");
        } else {
            input = document.createElement("input");
            input.type = type || "text";
        }

        input.name = name;
        input.value = value || "";

        label.appendChild(input);
        container.appendChild(label);

        return input;
    }

    function makeSelect(container, labelText, name, value, options) {
        var label = el("label", "", labelText);
        var select = document.createElement("select");
        select.name = name;

        options.forEach(function (option) {
            var item = document.createElement("option");
            item.value = option;
            item.textContent = option;
            select.appendChild(item);
        });

        select.value = value || options[0];

        label.appendChild(select);
        container.appendChild(label);

        return select;
    }

    function makeEditor(event, li) {
        var editor = el("div", "event-editor");

        makeField(editor, "Event title", "title", event.title);
        makeSelect(
            editor,
            "Event type",
            "kind",
            event.kind,
            ["Event", "Conference", "Appearance"]
        );
        makeField(editor, "Date", "date", event.date, "date");
        makeField(editor, "Time", "time", event.time, "time");
        makeField(editor, "Location", "location", event.location || event.where);
        makeField(editor, "Description", "description", event.description, "textarea");
        makeField(editor, "Image path", "image", event.image);
        makeField(editor, "Event URL", "url", event.url, "url");

        var checkboxLabel = el("label", "event-checkbox");
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "sample";
        checkbox.checked = isSample(event.sample);

        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(document.createTextNode("Sample entry"));
        editor.appendChild(checkboxLabel);

        var actions = el("div", "event-editor-actions");

        var saveButton = makeButton("Save Changes", "btn btn-tan", async function () {
            var updated = {};

            editor.querySelectorAll("input, textarea, select").forEach(function (field) {
                if (field.name === "sample") {
                    updated.sample = field.checked;
                } else {
                    updated[field.name] = field.value.trim();
                }
            });

            if (!updated.title) {
                alert("Please enter an event title.");
                return;
            }

            if (updated.date && !parseDate(updated.date)) {
                alert("Please enter a valid event date.");
                return;
            }

            saveButton.disabled = true;
            setStatus("Saving event...");

            try {
                await sendRequest({
                    action: "update",
                    id: event.id,
                    updated_data: updated
                });

                setStatus("Event saved.");
                await loadEvents();
            } catch (error) {
                console.error(error);
                setStatus("Could not save the event. Check the Apps Script deployment.");
                saveButton.disabled = false;
            }
        });

        var deleteButton = makeButton("Delete Event", "btn btn-light", async function () {
            if (!confirm("Are you sure you want to delete this event?")) {
                return;
            }

            deleteButton.disabled = true;
            setStatus("Deleting event...");

            try {
                await sendRequest({
                    action: "delete",
                    id: event.id
                });

                setStatus("Event deleted.");
                await loadEvents();
            } catch (error) {
                console.error(error);
                setStatus("Could not delete the event.");
                deleteButton.disabled = false;
            }
        });

        actions.appendChild(saveButton);
        actions.appendChild(deleteButton);
        editor.appendChild(actions);

        li.appendChild(editor);
    }

    function card(event) {
        var date = parseDate(event.date);
        var li = el("li", "event");
        li.dataset.id = event.id || "";

        var media = el("div", "event-media");

        if (event.image) {
            var img = document.createElement("img");
            img.src = event.image;
            img.alt = "";
            media.appendChild(img);
        } else if (date) {
            var badge = el("div", "date-badge");
            badge.appendChild(el("span", "m", date.toLocaleDateString("en-US", { month: "short" })));
            badge.appendChild(el("span", "d", String(date.getDate())));
            media.appendChild(badge);
        } else {
            media.appendChild(el("span", "", "Date to be announced"));
        }

        li.appendChild(media);

        var body = el("div", "event-body");

        if (event.kind) {
            body.appendChild(el("p", "event-kind", event.kind));
        }

        body.appendChild(el("h3", "", event.title || "Untitled Event"));

        var details = document.createElement("dl");

        var when = date ? formatDate(date) : "To be announced";

        if (event.time) {
            when += " at " + formatTime(event.time);
        }

        row(details, "When", when);
        row(details, "Where", event.location || event.where || "To be announced");

        body.appendChild(details);

        if (event.description) {
            body.appendChild(el("p", "", event.description));
        }

        if (event.url) {
            var link = el("a", "more", "Details");
            link.href = event.url;
            link.target = "_blank";
            link.rel = "noopener";
            body.appendChild(link);
        }

        if (isSample(event.sample)) {
            body.appendChild(el("span", "sample-tag", "Sample entry"));
        }

        if (editMode) {
            body.appendChild(makeButton("Edit Event", "btn btn-light event-edit-button", function () {
                var existingEditor = li.querySelector(".event-editor");

                if (existingEditor) {
                    existingEditor.remove();
                    return;
                }

                makeEditor(event, li);
            }));
        }

        li.appendChild(body);
        return li;
    }

    function renderEvents() {
        var upcomingBox = document.getElementById("upcoming");
        var pastBox = document.getElementById("past");

        if (!upcomingBox || !pastBox) return;

        upcomingBox.innerHTML = "";
        pastBox.innerHTML = "";

        var now = new Date();

        var upcoming = events.filter(function (event) {
            var dateTime = getEventDateTime(event);
            return !dateTime || dateTime >= now;
        });

        var past = events.filter(function (event) {
            var dateTime = getEventDateTime(event);
            return dateTime && dateTime < now;
        });

        upcoming.sort(function (a, b) {
            var dateA = getEventDateTime(a);
            var dateB = getEventDateTime(b);

            if (!dateA) return 1;
            if (!dateB) return -1;

            return dateA - dateB;
        });

        past.sort(function (a, b) {
            return getEventDateTime(b) - getEventDateTime(a);
        });

        upcoming.forEach(function (event) {
            upcomingBox.appendChild(card(event));
        });

        past.forEach(function (event) {
            pastBox.appendChild(card(event));
        });

        document.getElementById("upcoming-empty").hidden = upcoming.length !== 0;
        document.getElementById("past-empty").hidden = past.length !== 0;

        document.dispatchEvent(new Event("events-edit-mode"));
    }

    async function sendRequest(payload) {
        var response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        var result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Request failed.");
        }

        return result;
    }

    async function loadEvents() {
        setStatus("Loading events...");

        try {
            var response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error("Could not load events.");
            }

            var data = await response.json();

            events = (Array.isArray(data) ? data : []).map(function (event) {
                return {
                    id: event.id,
                    title: event.title || "",
                    kind: event.kind || "",
                    date: event.date || "",
                    time: event.time || "",
                    location: event.location || "",
                    where: event.location || "",
                    description: event.description || "",
                    image: event.image || "",
                    url: event.url || "",
                    sample: isSample(event.sample),
                    order: Number(event.order) || 0
                };
            });

            renderEvents();
            setStatus("");
        } catch (error) {
            console.error(error);
            setStatus("Could not load events. Check the Events sheet and Apps Script deployment.");
        }
    }

    async function addEvent() {
        try {
            setStatus("Adding event...");

            await sendRequest({
                action: "create",
                type: "event"
            });

            editMode = true;
            await loadEvents();

            var editButton = document.getElementById("events-edit-toggle");
            if (editButton) {
                editButton.textContent = "Edit Mode: ON";
                editButton.style.backgroundColor = "#ffc107";
                editButton.style.color = "#000";
            }

            setStatus("New event added. Select Edit Event to fill in its details.");
        } catch (error) {
            console.error(error);
            setStatus("Could not add the event. Check the Apps Script deployment.");
        }
    }

    function start() {
        addStyles();
        addToolbar();
        loadEvents();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
})();