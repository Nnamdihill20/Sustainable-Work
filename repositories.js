const API_URL = "https://script.google.com/macros/s/AKfycbygYIDb1WrysBoBVqNZUO4FmBcJm5cBVUEwJw39VTdoBJmnZ-CgauR1T48uC4wPdZ5kiA/exec";

(function () {
	var data = [];
	var isEditModeActive = false;

	var form = document.getElementById('repo-form');
	var qEl = document.getElementById('q');
	var toggle = document.getElementById('filter-toggle');
	var panel = document.getElementById('filter-panel');
	var topicEl = document.getElementById('topic');
	var sortEl = document.getElementById('sort');
	var list = document.getElementById('results');
	var count = document.getElementById('count');
	var clearBtn = document.getElementById('clear');
	var empty = document.getElementById('empty');

	function el(tag, cls, text) {
		var e = document.createElement(tag);
		if (cls) { e.className = cls; }
		if (text) { e.textContent = text; }
		return e;
	}

	function formatPublicationDate(dateStr) {
		if (!dateStr) return "";
		if (isNaN(Date.parse(dateStr)) || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
			return dateStr;
		}
		var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		var parsedDate = new Date(dateStr);
		var localizedDate = new Date(parsedDate.getTime() + parsedDate.getTimezoneOffset() * 60000);
		var day = localizedDate.getDate();
		var suffix = "th";
		if (day < 11 || day > 13) {
			switch (day % 10) {
				case 1: suffix = "st"; break;
				case 2: suffix = "nd"; break;
				case 3: suffix = "rd"; break;
			}
		}
		return months[localizedDate.getMonth()] + " " + day + suffix + ", " + localizedDate.getFullYear();
	}

	function fetchRepositoryData() {
		// Uses standard redirect handling natively for clean CORS resolution
		fetch(API_URL)
			.then(function (response) { return response.json(); })
			.then(function (fetchedData) {
				data = fetchedData.map(function (row) {
					return {
						title: row.title || "",
						authors: row.authors || row.author || "",
						date: formatPublicationDate(row.date || row.year || ""),
						abstract: row.abstract || row.description || "",
						tags: row.tags || row.topic ? (row.tags || row.topic).split(',').map(function(t){ return t.trim(); }).filter(Boolean) : [],
						keywords: row.keywords ? row.keywords.split(',').map(function(k){ return k.trim(); }).filter(Boolean) : [],
						url: row.url || "",
						pdf: row.pdf || "",
						rawSortDate: row.date || row.year || "",
						sheet_row_index: row.sheet_row_index
					};
				});
				buildTopicOptions();
				checkInitialUrlParams();
				render();
			})
			.catch(function (err) {
				list.textContent = '';
				list.appendChild(el('li', '', 'Failed to sync with repository database stream. Verification of API Deployment configuration required.'));
			});
	}

	function buildTopicOptions() {
		var currentSelection = topicEl.value;
		var seen = {};
		data.forEach(function (p) { (p.tags || []).forEach(function (t) { seen[t] = true; }); });
		topicEl.innerHTML = '<option value="">All topics</option>';
		Object.keys(seen).sort().forEach(function (t) {
			var o = el('option', '', t);
			o.value = t;
			topicEl.appendChild(o);
		});
		topicEl.value = currentSelection;
	}

	function checkInitialUrlParams() {
		var params = new URLSearchParams(window.location.search);
		if (params.get('q')) qEl.value = params.get('q');
		if (params.get('topic')) {
			topicEl.value = params.get('topic');
			setPanel(true);
		}
	}

	function injectEditToggleButton() {
		var resultLine = document.querySelector('.result-line');
		if (!resultLine || document.getElementById('global-edit-toggle')) return;

		var toggleBtn = el('button', 'btn btn-light', 'Edit Mode: OFF');
		toggleBtn.id = 'global-edit-toggle';
		toggleBtn.type = 'button';
		toggleBtn.style.marginLeft = '15px';

		toggleBtn.addEventListener('click', function () {
			isEditModeActive = !isEditModeActive;
			if (isEditModeActive) {
				toggleBtn.textContent = 'Edit Mode: ON';
				toggleBtn.style.backgroundColor = '#ffc107';
				toggleBtn.style.color = '#000';
			} else {
				toggleBtn.textContent = 'Edit Mode: OFF';
				toggleBtn.style.backgroundColor = '';
				toggleBtn.style.color = '';
			}
			render();
		});
		resultLine.appendChild(toggleBtn);
	}

	function createNewRepositoryEntry() {
		var addCardBtn = document.getElementById('add-entry-title-text');
		if (addCardBtn) addCardBtn.textContent = "Creating New Blank Entry...";

		fetch(API_URL, {
			method: "POST",
			mode: "no-cors",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "create" })
		})
		.then(function() {
			setTimeout(function() {
				fetchRepositoryData();
			}, 1500);
		});
	}

	function setPanel(open) {
		panel.hidden = !open;
		toggle.setAttribute('aria-expanded', String(open));
	}

	function haystack(p) {
		return [p.title, p.authors, p.abstract, (p.tags || []).join(' '), (p.keywords || []).join(' ')].join(' ').toLowerCase();
	}

	function time(p) {
		if (!p.rawSortDate) {
			return isEditModeActive ? Date.now() : 0;
		}
		var t = Date.parse(p.rawSortDate);
		return isNaN(t) ? 0 : t;
	}

	function card(p) {
		var li = el('li', 'paper');
		var editableAttr = isEditModeActive ? 'true' : 'false';
		var editStyle = isEditModeActive ? 'background-color: #fffde7; padding: 2px 4px; border-radius: 4px; outline: none;' : '';

		// Title
		var h2 = el('h2', '');
		h2.textContent = p.title;
		h2.setAttribute('contenteditable', editableAttr);
		h2.setAttribute('style', editStyle);
		h2.dataset.key = 'title';
		li.appendChild(h2);

		// Meta Row
		var metaText = [p.authors, p.date].filter(Boolean).join(' · ');
		if (metaText || isEditModeActive) {
			var pMeta = el('p', 'paper-meta');
			var spanAuthors = el('span', '');
			spanAuthors.textContent = p.authors || (isEditModeActive ? 'Author name(s)' : '');
			spanAuthors.setAttribute('contenteditable', editableAttr);
			spanAuthors.setAttribute('style', editStyle);
			spanAuthors.dataset.key = 'authors';

			var divider = document.createTextNode(' · ');

			var spanDate = el('span', '');
			spanDate.textContent = p.date || (isEditModeActive ? 'Date' : '');
			spanDate.setAttribute('contenteditable', editableAttr);
			spanDate.setAttribute('style', editStyle);
			spanDate.dataset.key = 'date';

			pMeta.appendChild(spanAuthors);
			pMeta.appendChild(divider);
			pMeta.appendChild(spanDate);
			li.appendChild(pMeta);
		}

		// Abstract
		if (p.abstract || isEditModeActive) {
			var pAbstract = el('p', 'paper-abstract');
			pAbstract.textContent = p.abstract;
			pAbstract.setAttribute('contenteditable', editableAttr);
			pAbstract.setAttribute('style', editStyle + ' display: block;');
			pAbstract.dataset.key = 'abstract';
			li.appendChild(pAbstract);
		}

		// Chips Display
		if (!isEditModeActive && p.tags && p.tags.length) {
			var ul = el('ul', 'chips');
			p.tags.forEach(function (t) {
				var item = el('li');
				var a = el('a', '', t);
				a.href = '?topic=' + encodeURIComponent(t);
				a.addEventListener('click', function (ev) {
					ev.preventDefault();
					topicEl.value = t;
					setPanel(true);
					render();
				});
				item.appendChild(a);
				ul.appendChild(item);
			});
			li.appendChild(ul);
		}

		// Interactive Tags / Topics Editor
		if (isEditModeActive) {
			var tWrapper = el('p', 'paper-abstract');
			tWrapper.style.fontSize = '0.85em';
			tWrapper.style.color = '#555';
			tWrapper.style.marginTop = '10px';
			tWrapper.innerHTML = '<strong>Topics / Tags (comma-separated):</strong> ';

			var tSpan = el('span', '');
			tSpan.textContent = p.tags.join(', ');
			tSpan.setAttribute('contenteditable', 'true');
			tSpan.setAttribute('style', editStyle + ' display: inline-block; width: 75%;');
			tSpan.dataset.key = 'tags';

			tWrapper.appendChild(tSpan);
			li.appendChild(tWrapper);
		}

		// Inline Keywords Editor
		if (isEditModeActive) {
			var kWrapper = el('p', 'paper-abstract');
			kWrapper.style.fontSize = '0.85em';
			kWrapper.style.color = '#555';
			kWrapper.style.marginTop = '5px';
			kWrapper.innerHTML = '<strong>Keywords (comma-separated):</strong> ';

			var kSpan = el('span', '');
			kSpan.textContent = p.keywords.join(', ');
			kSpan.setAttribute('contenteditable', 'true');
			kSpan.setAttribute('style', editStyle + ' display: inline-block; width: 75%;');
			kSpan.dataset.key = 'keywords';

			kWrapper.appendChild(kSpan);
			li.appendChild(kWrapper);
		}

		// Url Field Editor Panel
		if (isEditModeActive) {
			var urlWrapper = el('div', '');
			urlWrapper.style.fontSize = '0.85em';
			urlWrapper.style.color = '#555';
			urlWrapper.style.marginTop = '10px';
			urlWrapper.style.padding = '5px 0';
			urlWrapper.style.borderTop = '1px dashed #ddd';

			var urlPara = el('p', 'paper-abstract');
			urlPara.style.margin = '5px 0';
			urlPara.innerHTML = '<strong>Read Online URL:</strong> ';
			var urlSpan = el('span', '');
			urlSpan.textContent = p.url;
			urlSpan.setAttribute('contenteditable', 'true');
			urlSpan.setAttribute('style', editStyle + ' display: inline-block; width: 75%; word-break: break-all;');
			urlSpan.dataset.key = 'url';
			urlPara.appendChild(urlSpan);
			urlWrapper.appendChild(urlPara);

			var pdfPara = el('p', 'paper-abstract');
			pdfPara.style.margin = '5px 0';
			pdfPara.innerHTML = '<strong>Download PDF URL:</strong> ';
			var pdfSpan = el('span', '');
			pdfSpan.textContent = p.pdf;
			pdfSpan.setAttribute('contenteditable', 'true');
			pdfSpan.setAttribute('style', editStyle + ' display: inline-block; width: 75%; word-break: break-all;');
			pdfSpan.dataset.key = 'pdf';
			pdfPara.appendChild(pdfSpan);
			urlWrapper.appendChild(pdfPara);

			li.appendChild(urlWrapper);
		}

		// Resource Action links
		var links = el('p', 'paper-links');
		if (!isEditModeActive) {
			if (p.pdf) {
				var d = el('a', '', 'Download PDF');
				d.href = p.pdf;
				links.appendChild(d);
			}
			if (p.url) {
				var r = el('a', '', 'Read online');
				r.href = p.url;
				r.target = '_blank';
				r.rel = 'noopener';
				links.appendChild(r);
			}
		}

		// Interactive Control Buttons
		if (isEditModeActive) {
			var saveBtn = el('button', 'btn', 'Save Changes');
			saveBtn.type = 'button';
			saveBtn.style.cursor = 'pointer';
			saveBtn.addEventListener('click', function (e) { saveItemChanges(e, p.sheet_row_index, li); });
			links.appendChild(saveBtn);

			var deleteBtn = el('button', 'btn', 'Delete Entry');
			deleteBtn.type = 'button';
			deleteBtn.style.cursor = 'pointer';
			deleteBtn.style.backgroundColor = '#dc3545';
			deleteBtn.style.borderColor = '#dc3545';
			deleteBtn.style.color = '#fff';
			deleteBtn.style.marginLeft = '10px';
			deleteBtn.addEventListener('click', function (e) { deleteRepositoryItem(e, p.sheet_row_index); });
			links.appendChild(deleteBtn);
		}

		if (links.childNodes.length) { li.appendChild(links); }

		return li;
	}

	function saveItemChanges(event, sheetRowIndex, cardElement) {
		var btn = event.target;
		var originalText = btn.textContent;
		btn.textContent = "Saving...";
		btn.disabled = true;

		var updatedData = {};
		var editableFields = cardElement.querySelectorAll("[contenteditable='true']");
		
		editableFields.forEach(function (field) {
			updatedData[field.dataset.key] = field.textContent.trim();
		});

		var payload = {
			sheet_row_index: sheetRowIndex,
			updated_data: updatedData
		};

		fetch(API_URL, {
			method: "POST",
			mode: "no-cors",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload)
		})
		.then(function () {
			btn.textContent = "Saved!";
			setTimeout(function () {
				btn.textContent = originalText;
				btn.disabled = false;
				fetchRepositoryData();
			}, 1200);
		});
	}

	function deleteRepositoryItem(event, sheetRowIndex) {
		if (!confirm("Are you sure you want to completely remove this entry from your Google Sheet database?")) return;
		var btn = event.target;
		btn.textContent = "Deleting...";
		btn.disabled = true;

		fetch(API_URL, {
			method: "POST",
			mode: "no-cors",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "delete", sheet_row_index: sheetRowIndex })
		})
		.then(function () {
			setTimeout(function () {
				fetchRepositoryData();
			}, 1200);
		});
	}

	function render() {
		var words = qEl.value.toLowerCase().split(/\s+/).filter(Boolean);
		var topic = topicEl.value;
		var out = data.filter(function (p) {
			if (topic && (p.tags || []).indexOf(topic) === -1) { return false; }
			var h = haystack(p);
			return words.every(function (w) { return h.indexOf(w) !== -1; });
		});
		var how = sortEl.value;
		out.sort(function (a, b) {
			if (how === 'title') { return a.title.localeCompare(b.title); }
			if (how === 'oldest') { return time(a) - time(b); }
			return time(b) - time(a);
		});
		
		list.textContent = '';

		if (isEditModeActive) {
			var addLi = el('li', 'paper');
			addLi.id = "add-entry-btn";
			addLi.style.border = "2px dashed #ccc";
			addLi.style.textAlign = "center";
			addLi.style.cursor = "pointer";
			
			var addHeading = el('h2', '', '➕ Add New Entry');
			addHeading.id = 'add-entry-title-text';
			addHeading.style.margin = "10px 0";
			
			addLi.appendChild(addHeading);
			addLi.addEventListener('click', createNewRepositoryEntry);
			list.appendChild(addLi);
		}

		out.forEach(function (p) { list.appendChild(card(p)); });
		empty.hidden = out.length !== 0;
		var bits = [];
		if (qEl.value.trim()) { bits.push('matching “' + qEl.value.trim() + '”'); }
		if (topic) { bits.push('in ' + topic); }
		count.textContent = out.length + (out.length === 1 ? ' result' : ' results') + (bits.length ? ' ' + bits.join(' ') : '');
		clearBtn.hidden = !(qEl.value.trim() || topic);
		try {
			var next = new URLSearchParams();
			if (qEl.value.trim()) { next.set('q', qEl.value.trim()); }
			if (topic) { next.set('topic', topic); }
			var s = next.toString();
			window.history.replaceState(null, '', s ? '?' + s : window.location.pathname);
		} catch (e) {}
	}

	form.addEventListener('submit', function (ev) { ev.preventDefault(); render(); });
	qEl.addEventListener('input', render);
	topicEl.addEventListener('change', render);
	sortEl.addEventListener('change', render);
	toggle.addEventListener('click', function () { setPanel(panel.hidden); });
	clearBtn.addEventListener('click', function () {
		qEl.value = '';
		topicEl.value = '';
		render();
		qEl.focus();
	});

	injectEditToggleButton();
	fetchRepositoryData();
})();
