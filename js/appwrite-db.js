// Loads and saves Repositories entries in Appwrite. Edit Mode needs an admin login.
(function () {
	var ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
	var PROJECT_ID = '6ade3982003e043d07b2';
	var DB_ID = 'swl';
	var TABLE_ID = 'publications';
	var ADMIN_TEAM = 'admins';

	var client = new Appwrite.Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
	var db = new Appwrite.TablesDB(client);
	var account = new Appwrite.Account(client);
	var teams = new Appwrite.Teams(client);
	var Query = Appwrite.Query;

	var COLUMNS = {
		title: 'title',
		authors: 'authors',
		date: 'publication_date',
		abstract: 'description',
		tags: 'tags',
		keywords: 'keywords',
		url: 'read_online_url',
		pdf: 'pdf_url'
	};

	function toPage(row) {
		var p = { sheet_row_index: row.$id };
		Object.keys(COLUMNS).forEach(function (key) { p[key] = row[COLUMNS[key]] || ''; });
		return p;
	}

	function cleanDate(text) {
		if (/^\d{4}-\d{2}-\d{2}/.test(text)) { return text.slice(0, 10); }
		var m = /^([A-Za-z]+) (\d{1,2})(st|nd|rd|th)?,? (\d{4})$/.exec(text);
		if (!m) { return text; }
		var d = new Date(m[1] + ' ' + m[2] + ', ' + m[4]);
		if (isNaN(d)) { return text; }
		return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
	}

	function toRow(data) {
		var row = {};
		Object.keys(data).forEach(function (key) {
			if (!COLUMNS[key]) { return; }
			var value = String(data[key] || '').trim();
			if ((key === 'authors' && value === 'Author name(s)') || (key === 'date' && value === 'Date')) { value = ''; }
			if (key === 'date') { value = cleanDate(value); }
			row[COLUMNS[key]] = value;
		});
		if ('title' in row && !row.title) { row.title = 'Untitled'; }
		return row;
	}

	function showError(err) {
		alert('Could not save to the database: ' + (err && err.message ? err.message : err));
	}

	function list() {
		var all = [];
		function page(cursor) {
			var queries = [Query.limit(100), Query.orderDesc('$createdAt')];
			if (cursor) { queries.push(Query.cursorAfter(cursor)); }
			return db.listRows({ databaseId: DB_ID, tableId: TABLE_ID, queries: queries }).then(function (res) {
				all = all.concat(res.rows);
				if (res.rows.length === 100) { return page(res.rows[99].$id); }
				return all.map(toPage);
			});
		}
		return page(null);
	}

	function create() {
		return db.createRow({ databaseId: DB_ID, tableId: TABLE_ID, rowId: Appwrite.ID.unique(), data: { title: 'New entry' } })
			.catch(showError);
	}

	function update(id, data) {
		return db.updateRow({ databaseId: DB_ID, tableId: TABLE_ID, rowId: id, data: toRow(data) })
			.catch(showError);
	}

	function remove(id) {
		return db.deleteRow({ databaseId: DB_ID, tableId: TABLE_ID, rowId: id })
			.catch(showError);
	}

	function isAdmin() {
		return account.get()
			.then(function () { return teams.list(); })
			.then(function (res) { return res.teams.some(function (t) { return t.$id === ADMIN_TEAM; }); })
			.catch(function () { return false; });
	}

	function loginDialog() {
		return new Promise(function (resolve) {
			var dlg = document.createElement('dialog');
			dlg.innerHTML =
				'<form method="dialog" style="display:grid;gap:8px;min-width:260px">' +
				'<strong>Admin login</strong>' +
				'<input name="email" type="email" placeholder="Email" required autocomplete="username">' +
				'<input name="password" type="password" placeholder="Password" required autocomplete="current-password">' +
				'<p class="login-msg" style="color:#dc3545;margin:0"></p>' +
				'<div><button class="btn" value="login">Log in</button> <button class="btn btn-light" value="cancel" formnovalidate>Cancel</button></div>' +
				'</form>';
			document.body.appendChild(dlg);
			var form = dlg.querySelector('form');
			var msg = dlg.querySelector('.login-msg');

			form.addEventListener('submit', function (ev) {
				if (ev.submitter && ev.submitter.value === 'cancel') { return; }
				ev.preventDefault();
				msg.textContent = 'Logging in...';
				account.createEmailPasswordSession({ email: form.elements.email.value, password: form.elements.password.value })
					.then(isAdmin)
					.then(function (ok) {
						if (ok) { dlg.close('ok'); return; }
						msg.textContent = 'This account is not an admin.';
						return account.deleteSession({ sessionId: 'current' });
					})
					.catch(function (err) { msg.textContent = err.message; });
			});
			dlg.addEventListener('close', function () {
				var ok = dlg.returnValue === 'ok';
				dlg.remove();
				resolve(ok);
			});
			dlg.showModal();
		});
	}

	function requireAdmin() {
		return isAdmin().then(function (ok) { return ok || loginDialog(); });
	}

	function logout() {
		return account.deleteSession({ sessionId: 'current' }).catch(function () {});
	}

	var allowedOnce = false;
	document.addEventListener('click', function (ev) {
		var btn = ev.target.closest && ev.target.closest('#global-edit-toggle');
		if (!btn || allowedOnce || btn.textContent.indexOf('OFF') === -1) { allowedOnce = false; return; }
		ev.stopImmediatePropagation();
		requireAdmin().then(function (ok) {
			if (ok) { allowedOnce = true; btn.click(); }
		});
	}, true);

	window.SWL_DB = { list: list, create: create, update: update, remove: remove, requireAdmin: requireAdmin, logout: logout };
})();
