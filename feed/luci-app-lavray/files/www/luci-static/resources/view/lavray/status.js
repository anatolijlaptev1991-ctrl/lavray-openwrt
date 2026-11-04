// SPDX-License-Identifier: GPL-3.0-only
//
// Страница LuCI «Сервисы → LAVRay» (спецификация OPENWRT-PACKAGING §3.6):
// статус службы и ядра, отпечаток сертификата (проверка до первого входа),
// код первичной настройки (пока админа нет), переключатель шлюза и ссылка
// на панель в новой вкладке — ядро запрещает встраивание во фрейм
// (frame-ancestors 'none').
//
// Поля ответов ядра приходят в camelCase (protojson; UseProtoNames сервер
// не выставляет) — читаем bindAddress/tlsEnabled/... , не snake_case.
// Исходные строки _('…') здесь русские (проект русскоязычный); перевод
// на другие языки LuCI — через po/, позже.

'use strict';
'require rpc';
'require poll';
'require view';

var callStatus = rpc.declare({ object: 'lavray', method: 'get_status' });
var callWeb = rpc.declare({ object: 'lavray', method: 'get_web' });
var callGateway = rpc.declare({ object: 'lavray', method: 'get_gateway' });
var callSetupCode = rpc.declare({ object: 'lavray', method: 'get_setup_code' });
var callSetGateway = rpc.declare({ object: 'lavray', method: 'set_gateway', params: [ 'enable' ] });

var state = { status: {}, web: {}, gateway: {}, setup: {} };

function errText(d) {
	if (d && d.error)
		return _('Ядро: %s — %s').format(d.error, d.message || '');
	return null;
}

function renderStatus() {
	var e = errText(state.status);
	if (e)
		return E('div', { 'class': 'alert-message warning' }, e);

	var s = state.status || {};
	var running = !!s.serviceRunning;
	var conn = s.state || 'CORE_STATE_IDLE';
	var connRu = (conn == 'CORE_STATE_CONNECTED')
		? _('подключено')
		: (conn == 'CORE_STATE_CONNECTING') ? _('подключается') : _('отключено');

	return E('table', { 'class': 'table' }, [
		E('tr', {}, [ E('td', {}, _('Служба lavrayd')), E('td', {}, running ? _('запущена') : _('остановлена')) ]),
		E('tr', {}, [ E('td', {}, _('Соединение')), E('td', {}, connRu) ]),
		E('tr', {}, [ E('td', {}, _('Версия ядра')), E('td', {}, s.coreVersion || '—') ]),
		E('tr', {}, [ E('td', {}, _('Профиль')), E('td', {}, s.activeProfileName || '—') ]),
		E('tr', {}, [ E('td', {}, _('Режим')), E('td', {}, (s.mode || '').replace('CONNECT_MODE_', '').toLowerCase() || '—') ])
	]);
}

function renderWeb() {
	var e = errText(state.web);
	if (e)
		return E('div', { 'class': 'alert-message warning' }, e);

	var w = state.web || {};
	var setup = state.setup || {};
	var items = [
		E('tr', {}, [ E('td', {}, _('Адрес панели')), E('td', {}, w.bindAddress || '—') ]),
		E('tr', {}, [ E('td', {}, _('TLS')), E('td', {}, w.tlsEnabled ? _('включён') : _('выключен (пароль идёт открытым текстом!)')) ]),
		E('tr', {}, [ E('td', {}, _('Отпечаток сертификата (SHA-256)')), E('td', { 'class': 'monospace' }, w.tlsFingerprintSha256 || '—') ])
	];

	if (w.firstRunSetupRequired && setup.present)
		items.push(E('tr', {}, [
			E('td', {}, _('Код первичной настройки')),
			E('td', { 'class': 'monospace' }, setup.code || '—')
		]));
	else if (w.firstRunSetupRequired && !setup.present)
		items.push(E('tr', {}, [
			E('td', {}, _('Код первичной настройки')),
			E('td', {}, _('файл не найден: прочитайте его на роутере (cat %s)').format('/etc/lavray/data/web-setup-code'))
		]));

	return E('table', { 'class': 'table' }, items);
}

function renderGateway() {
	var e = errText(state.gateway);
	if (e)
		return E('div', { 'class': 'alert-message warning' }, e);

	var g = state.gateway || {};
	var tproxy = (g.mode == 'MODE_TPROXY');

	return E('table', { 'class': 'table' }, [
		E('tr', {}, [ E('td', {}, _('Режим шлюза')), E('td', {}, tproxy ? _('tproxy включён') : _('выключен')) ]),
		E('tr', {}, [ E('td', {}, _('Правила nft')), E('td', {}, g.nftRulesActive ? _('применены') : _('сняты')) ]),
		E('tr', {}, [ E('td', {}, _('Страж сработал')), E('td', {}, g.watchdogTripped ? _('да (трафик идёт напрямую)') : _('нет')) ]),
		E('tr', {}, [ E('td', {}, _('Перехваченных потоков')), E('td', {}, (g.interceptedFlows != null) ? String(g.interceptedFlows) : '—') ]),
		E('tr', {}, [ E('td', {}, _('Переключить')), E('td', {},
			E('button', {
				'class': 'btn cbi-button cbi-button-' + (tproxy ? 'remove' : 'apply'),
				'click': function(ev) {
					var btn = ev.target;
					btn.disabled = true;
					callSetGateway(!tproxy)
						.then(function() { return poll.tick(); })
						.catch(function() {})
						.finally(function() { btn.disabled = false; });
				}
			}, tproxy ? _('Выключить шлюз') : _('Включить шлюз (tproxy)'))
		) ])
	]);
}

function refresh() {
	return Promise.all([
		callStatus(), callWeb(), callGateway(), callSetupCode()
	]).then(function(data) {
		state.status = data[0];
		state.web = data[1];
		state.gateway = data[2];
		state.setup = data[3];
	});
}

return view.extend({
	load: function() {
		return refresh();
	},

	render: function() {
		var panel = E('div', { 'class': 'cbi-map' }, [
			E('h3', {}, _('Служба и соединение')),
			E('div', { 'id': 'lavray-status', 'class': 'cbi-section' }, renderStatus()),
			E('h3', {}, _('Веб-панель')),
			E('div', { 'id': 'lavray-web', 'class': 'cbi-section' }, renderWeb()),
			E('p', {},
				E('a', {
					'href': state.web && state.web.bindAddress
						? 'http' + ((state.web.tlsEnabled) ? 's' : '') + '://' + (state.web.bindAddress || '') + '/'
						: '#',
					'target': '_blank',
					'rel': 'noopener'
				}, _('Открыть панель в новой вкладке'))
			),
			E('h3', {}, _('Шлюз (tproxy)')),
			E('div', { 'id': 'lavray-gateway', 'class': 'cbi-section' }, renderGateway()),
			E('div', { 'class': 'alert-message info' },
				_('Политики устройств (per-MAC) настраиваются в самой панели; здесь — только общий переключатель и статус.'))
		]);

		poll.add(L.bind(function() {
			return refresh().then(function() {
				var ids = [ 'lavray-status', 'lavray-web', 'lavray-gateway' ];
				var html = [ renderStatus(), renderWeb(), renderGateway() ];

				for (var i = 0; i < ids.length; i++) {
					var box = document.getElementById(ids[i]);
					if (box) {
						box.innerHTML = '';
						box.appendChild(html[i]);
					}
				}
			});
		}, this), 5);

		return panel;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
