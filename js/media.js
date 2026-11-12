
/*
 * Sustainable Work Lab
 * Media Page
 *
 * Handles:
 * - Loading featured articles and videos
 * - Adding media entries
 * - Editing media entries
 * - Removing media entries
 * - Saving changes to Google Sheets
 */

var MEDIA_API_URL =
    "https://script.google.com/macros/s/AKfycby6vSWPWTubpRtfYicgx1xst5SDqqHh5z-EQfUP3rEeJxemsARszk7t0IAivt_aYCsj3Q/exec?sheet=Media";

var mediaArticles = [];
var mediaVideos = [];
var mediaEditMode = false;


/*
 * Start the Media page.
 */
document.addEventListener("DOMContentLoaded", function () {
    injectMediaControls();
    loadMedia();
});


/*
 * Add Edit Mode and management buttons.
 */
function injectMediaControls() {
    var pageHead = document.querySelector(".page-head");

    if (!pageHead) return;

    var editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-light";
    editButton.id = "media-edit-toggle";
    editButton.textContent = "Edit Mode: OFF";
    editButton.style.marginTop = "10px";

    editButton.addEventListener("click", function () {
        mediaEditMode = !mediaEditMode;

        editButton.textContent = mediaEditMode
            ? "Edit Mode: ON"
            : "Edit Mode: OFF";

        if (mediaEditMode) {
            editButton.style.backgroundColor = "#ffc107";
            editButton.style.color = "#000";
        } else {
            editButton.style.backgroundColor = "";
            editButton.style.color = "";
        }

        renderMedia();
    });

    pageHead.appendChild(editButton);

    var saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "btn";
    saveButton.id = "media-save-button";
    saveButton.textContent = "Save Changes";
    saveButton.style.marginLeft = "10px";
    saveButton.style.marginTop = "10px";
    saveButton.hidden = true;

    saveButton.addEventListener("click", saveMediaChanges);

    pageHead.appendChild(saveButton);

    var articlesSection = document.querySelector(
        '[aria-labelledby="articles-h"]'
    );

    var videosSection = document.querySelector(
        '[aria-labelledby="videos-h"]'
    );

    if (articlesSection) {
        var addArticleButton = document.createElement("button");
        addArticleButton.type = "button";
        addArticleButton.className = "btn btn-light";
        addArticleButton.id = "add-article-button";
        addArticleButton.textContent = "Add Article";
        addArticleButton.style.marginBottom = "15px";
        addArticleButton.hidden = true;

        addArticleButton.addEventListener("click", function () {
            addMedia("article");
        });

        articlesSection.querySelector("h2")
            .insertAdjacentElement("afterend", addArticleButton);
    }

    if (videosSection) {
        var addVideoButton = document.createElement("button");
        addVideoButton.type = "button";
        addVideoButton.className = "btn btn-light";
        addVideoButton.id = "add-video-button";
        addVideoButton.textContent = "Add Video";
        addVideoButton.style.marginBottom = "15px";
        addVideoButton.hidden = true;

        addVideoButton.addEventListener("click", function () {
            addMedia("video");
        });

        videosSection.querySelector("h2")
            .insertAdjacentElement("afterend", addVideoButton);
    }
}


/*
 * Load entries from the Media worksheet.
 */
async function loadMedia() {
    try {
        var response = await fetch(MEDIA_API_URL);

        if (!response.ok) {
            throw new Error("Unable to load Media entries.");
        }

        var data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error(data.error || "Invalid Media data.");
        }

        mediaArticles = data
            .filter(function (entry) {
                return entry.type === "article";
            })
            .sort(sortMediaEntries);

        mediaVideos = data
            .filter(function (entry) {
                return entry.type === "video";
            })
            .sort(sortMediaEntries);

        renderMedia();

    } catch (error) {
        console.error("Media loading error:", error);
        showMediaMessage(
            "Could not load Media entries. Check the spreadsheet connection."
        );
    }
}


/*
 * Sort entries by their display order.
 */
function sortMediaEntries(a, b) {
    return (Number(a.order) || 0) - (Number(b.order) || 0);
}


/*
 * Display articles and videos.
 */
function renderMedia() {
    renderArticles();
    renderVideos();

    var saveButton = document.getElementById("media-save-button");
    var addArticleButton = document.getElementById("add-article-button");
    var addVideoButton = document.getElementById("add-video-button");

    if (saveButton) {
        saveButton.hidden = !mediaEditMode;
        saveButton.style.display = mediaEditMode ? "" : "none";
    }

    if (addArticleButton) {
        addArticleButton.hidden = !mediaEditMode;
        addArticleButton.style.display = mediaEditMode ? "" : "none";
    }

    if (addVideoButton) {
        addVideoButton.hidden = !mediaEditMode;
        addVideoButton.style.display = mediaEditMode ? "" : "none";
    }
}


/*
 * Render Featured Articles.
 */
function renderArticles() {
    var articleGrid = document.querySelector(".article-grid");

    if (!articleGrid) return;

    articleGrid.replaceChildren();

    mediaArticles.forEach(function (article) {
        var item = document.createElement("li");
        item.className = mediaEditMode
            ? "article media-editor-card"
            : "article";
        item.dataset.id = article.id;

        if (mediaEditMode) {
            addArticleEditors(item, article);
        } else {
            var imageContainer = document.createElement("div");
            imageContainer.className = "media-ph";
            imageContainer.setAttribute("role", "img");
            imageContainer.setAttribute("aria-label", "Article image");

            if (article.image) {
                var image = document.createElement("img");
                image.src = article.image;
                image.alt = article.title || "Article image";

                imageContainer.appendChild(image);
            } else {
                imageContainer.textContent = "Image";
            }

            var body = document.createElement("div");
            body.className = "article-body";

            var title = document.createElement("h3");
            title.textContent = article.title || "Untitled Article";

            var source = document.createElement("p");
            source.className = "where";
            source.textContent = article.source || "";

            var link = document.createElement("a");
            link.className = "btn btn-tan";
            link.textContent = "Read the article";
            link.href = article.url || "#";
            link.target = "_blank";
            link.rel = "noopener";

            body.appendChild(title);
            body.appendChild(source);
            body.appendChild(link);

            item.appendChild(imageContainer);
            item.appendChild(body);
        }

        articleGrid.appendChild(item);
    });
}


/*
 * Add editing fields to an article.
 */
function addArticleEditors(item, article) {
    var editor = document.createElement("div");
    editor.className = "media-editor";

    var fields = document.createElement("div");
    fields.className = "media-editor-fields";

    var titleInput = createEditor(
        "Title",
        article.title,
        "article-title"
    );

    var sourceInput = createEditor(
        "Publication / Source",
        article.source,
        "article-source"
    );

    var urlInput = createEditor(
        "Article URL",
        article.url,
        "article-url",
        "url"
    );

    var imageInput = createEditor(
        "Image URL",
        article.image,
        "article-image",
        "url"
    );

    fields.appendChild(titleInput);
    fields.appendChild(sourceInput);
    fields.appendChild(urlInput);
    fields.appendChild(imageInput);

    editor.appendChild(fields);
    addDeleteButton(editor, article.id);
    item.appendChild(editor);
}


/*
 * Render Videos.
 */
function renderVideos() {
    var videoGrid = document.querySelector(".video-grid");

    if (!videoGrid) return;

    videoGrid.replaceChildren();

    mediaVideos.forEach(function (video) {
        var item = document.createElement("li");
        item.className = mediaEditMode
            ? "video media-editor-card"
            : "video";
        item.dataset.id = video.id;

        if (mediaEditMode) {
            var editor = document.createElement("div");
            editor.className = "media-editor";

            var fields = document.createElement("div");
            fields.className = "media-editor-fields";

            var titleInput = createEditor(
                "Video Title",
                video.title,
                "video-title"
            );

            var urlInput = createEditor(
                "YouTube URL",
                video.video_url,
                "video-url",
                "url"
            );

            fields.appendChild(titleInput);
            fields.appendChild(urlInput);

            editor.appendChild(fields);
            addDeleteButton(editor, video.id);
            item.appendChild(editor);
        } else {
            var iframe = document.createElement("iframe");
            iframe.className = "video-frame";
            iframe.src = getYouTubeEmbedUrl(video.video_url);
            iframe.title = video.title || "YouTube video";
            iframe.setAttribute("allowfullscreen", "");

            iframe.setAttribute(
                "allow",
                "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            );

            iframe.setAttribute(
                "referrerpolicy",
                "strict-origin-when-cross-origin"
            );

            var title = document.createElement("h3");
            title.textContent = video.title || "Untitled Video";

            item.appendChild(iframe);
            item.appendChild(title);
        }

        videoGrid.appendChild(item);
    });
}


/*
 * Convert a YouTube URL into an embed URL.
 */
function getYouTubeEmbedUrl(url) {
    if (!url) return "";

    try {
        var parsed = new URL(url);
        var videoId = "";

        if (parsed.hostname === "youtu.be") {
            videoId = parsed.pathname.substring(1);

        } else if (
            parsed.hostname.includes("youtube.com") ||
            parsed.hostname.includes("youtube-nocookie.com")
        ) {
            if (parsed.pathname === "/watch") {
                videoId = parsed.searchParams.get("v") || "";

            } else {
                var parts = parsed.pathname.split("/");
                var embedIndex = parts.findIndex(function (part) {
                    return part === "embed" || part === "shorts";
                });

                if (embedIndex !== -1) {
                    videoId = parts[embedIndex + 1] || "";
                }
            }
        }

        if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            return "";
        }

        return "https://www.youtube.com/embed/" + videoId;

    } catch (error) {
        return "";
    }
}


/*
 * Create a labeled editor field.
 */
function createEditor(labelText, value, className, inputType) {
    var wrapper = document.createElement("label");
    wrapper.className = "media-editor-field";

    var caption = document.createElement("span");
    caption.textContent = labelText;

    var input;
    if (inputType === "url") {
        input = document.createElement("textarea");
        input.rows = 2;
    } else {
        input = document.createElement("input");
        input.type = "text";
    }

    input.className = className;
    input.value = value || "";

    wrapper.appendChild(caption);
    wrapper.appendChild(input);

    return wrapper;
}


/*
 * Add a delete button to an entry.
 */
function addDeleteButton(item, id) {
    var deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn btn-light media-delete";
    deleteButton.textContent = "Remove";

    deleteButton.addEventListener("click", function () {
        deleteMedia(id);
    });

    item.appendChild(deleteButton);
}


/*
 * Send a request to the Google Sheets backend.
 */
async function sendMediaRequest(payload) {
    var response = await fetch(MEDIA_API_URL, {
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
 * Add a new article or video.
 */
async function addMedia(type) {
    try {
        await sendMediaRequest({
            action: "create",
            type: type
        });

        await loadMedia();

        showMediaMessage(
            "New " + type + " added. You can now edit its information."
        );

    } catch (error) {
        console.error("Add Media error:", error);
        showMediaMessage("Could not add entry: " + error.message);
    }
}


/*
 * Remove an article or video.
 */
async function deleteMedia(id) {
    if (!confirm("Are you sure you want to remove this entry?")) {
        return;
    }

    try {
        await sendMediaRequest({
            action: "delete",
            id: id
        });

        await loadMedia();

        showMediaMessage("Entry removed successfully.");

    } catch (error) {
        console.error("Delete Media error:", error);
        showMediaMessage("Could not remove entry: " + error.message);
    }
}


/*
 * Save all edited articles and videos.
 */
async function saveMediaChanges() {
    var saveButton = document.getElementById("media-save-button");

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        var updates = [];

        // Collect article edits.
        document.querySelectorAll(".article[data-id]").forEach(function (item) {
            updates.push({
                id: item.dataset.id,
                updated_data: {
                    title: item.querySelector(".article-title").value,
                    source: item.querySelector(".article-source").value,
                    url: item.querySelector(".article-url").value,
                    image: item.querySelector(".article-image").value
                }
            });
        });

        // Collect video edits.
        document.querySelectorAll(".video[data-id]").forEach(function (item) {
            updates.push({
                id: item.dataset.id,
                updated_data: {
                    title: item.querySelector(".video-title").value,
                    video_url: item.querySelector(".video-url").value
                }
            });
        });

        // Save each entry.
        for (var i = 0; i < updates.length; i++) {
            await sendMediaRequest({
                action: "update",
                id: updates[i].id,
                updated_data: updates[i].updated_data
            });
        }

        mediaEditMode = false;

        var editButton = document.getElementById("media-edit-toggle");
        editButton.textContent = "Edit Mode: OFF";
        editButton.style.backgroundColor = "";
        editButton.style.color = "";

        await loadMedia();

        showMediaMessage("Media changes saved successfully.");

    } catch (error) {
        console.error("Save Media error:", error);
        showMediaMessage("Could not save changes: " + error.message);

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
}


/*
 * Display a status message.
 */
function showMediaMessage(message) {
    var status = document.getElementById("media-edit-status");

    if (!status) {
        status = document.createElement("p");
        status.id = "media-edit-status";
        status.setAttribute("role", "status");

        var pageHead = document.querySelector(".page-head");

        if (pageHead) {
            pageHead.appendChild(status);
        }
    }

    status.textContent = message;
}