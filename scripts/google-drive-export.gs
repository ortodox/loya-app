/**
 * LOA – nightly export of all data to Google Drive (EX1, first part: data without files).
 * Not part of the app. Runs as a Google Apps Script project – setup in docs/EXPORT.md.
 *
 * Script Properties (Project Settings → Script Properties), never in this file:
 *   SUPABASE_URL       https://<project>.supabase.co
 *   SUPABASE_ANON_KEY  the public anon key (same as in the app)
 *   EXPORT_SECRET      from `select private.new_export_secret();`
 *   DRIVE_FOLDER_ID    the id of the folder «Loya Beauty app»
 *
 * Every run creates the spreadsheet «LOA eksport YYYY-MM-DD» in the subfolder «Eksport» and moves
 * to the trash only files in «Eksport» whose name starts with «LOA eksport» and that are older than
 * 30 days. Nothing is logged about clients; on any error the run fails and Google sends an e-mail.
 */

var TIME_ZONE = 'Europe/Warsaw';
var EXPORT_FOLDER = 'Eksport';
var FILE_PREFIX = 'LOA eksport';
var KEEP_DAYS = 30;
var MAX_CELL = 50000; // Google Sheets limit per cell

// Labels from src/config/kartaTemplate.ts and messages/ru.json (karta.*), in template order.
var ANAMNESIS_FIELDS = [
  { key: 'complaints', label: 'Жалобы', options: { skinTone: 'тон кожи', redness: 'покраснение', acne: 'акне', subcutaneousInflammation: 'подкожные воспаления', pigmentation: 'пигментация', wrinkles: 'морщины', dryness: 'сухость', enlargedPores: 'расширенные поры', gooseSkin: '«гусиная кожа»' } },
  { key: 'bloodPressure', label: 'Артериальное давление' },
  { key: 'endocrine', label: 'Эндокринная система' },
  { key: 'gastro', label: 'Желудочно-кишечный тракт' },
  { key: 'cardiovascular', label: 'Сердце и сосуды' },
  { key: 'genitourinary', label: 'Мочеполовая система' },
  { key: 'respiratory', label: 'Дыхательная система' },
  { key: 'injuriesSurgeries', label: 'Травмы и операции' },
  { key: 'allergies', label: 'Аллергоанамнез' },
  { key: 'medications', label: 'Принимаемые препараты (БАДы, витамины, лекарства, контрацептивы)' },
  { key: 'skinType', label: 'Тип кожи', options: { dry: 'сухая', oily: 'жирная', combination: 'комбинированная', normal: 'нормальная', sensitive: 'чувствительная' } },
  { key: 'skinFeatures', label: 'Особенности кожи', options: { pigmentation: 'пигментация', flaking: 'шелушения', rashes: 'высыпания', scars: 'рубчики' } },
  { key: 'skinDiseases', label: 'Болезни кожи', options: { acne: 'акне', couperose: 'купероз', postAcne: 'постакне', rosacea: 'розацеа' } },
  { key: 'agingType', label: 'Типы старения кожи', options: { photo: 'фотостарение', chrono: 'хроностарение', muscular: 'мышечный', fineWrinkled: 'мелкоморщинистый', edematousDeformational: 'отёчно-деформационный' } },
  { key: 'wrinkleTypes', label: 'Виды морщин', options: { static: 'статические', dynamic: 'динамические', mimic: 'мимические', gravitational: 'гравитационные' } },
  { key: 'salon', label: 'В салоне', options: { cleansing: 'чистка', peeling: 'пилинг', smas: 'SMAS', biorevitalization: 'биоревитализация', botox: 'ботокс', lipFillers: 'филлеры губ', polylacticAcid: 'полимолочная кислота' } },
  { key: 'injections', label: 'Инъекционные вмешательства' },
];

// Used when Intl.DisplayNames is not available in Apps Script.
var COUNTRIES_RU = {
  PL: 'Польша', UA: 'Украина', BY: 'Беларусь', DE: 'Германия', NO: 'Норвегия', RU: 'Россия', LT: 'Литва',
  LV: 'Латвия', EE: 'Эстония', CZ: 'Чехия', SK: 'Словакия', AT: 'Австрия', CH: 'Швейцария', NL: 'Нидерланды',
  BE: 'Бельгия', FR: 'Франция', GB: 'Великобритания', IE: 'Ирландия', IT: 'Италия', ES: 'Испания',
  PT: 'Португалия', SE: 'Швеция', FI: 'Финляндия', DK: 'Дания', IS: 'Исландия', HU: 'Венгрия', RO: 'Румыния',
  MD: 'Молдова', BG: 'Болгария', GR: 'Греция', HR: 'Хорватия', SI: 'Словения', RS: 'Сербия', TR: 'Турция',
  GE: 'Грузия', AM: 'Армения', AZ: 'Азербайджан', KZ: 'Казахстан', UZ: 'Узбекистан', IL: 'Израиль',
  AE: 'ОАЭ', US: 'США', CA: 'Канада', AU: 'Австралия',
};
var LANGUAGES_RU = { ru: 'Русский', uk: 'Украинский', pl: 'Польский', en: 'Английский' };
var DIRECTIONS_RU = { cosmetology: 'Косметология', dermatology: 'Дерматология' };
var UNITS_RU = { days: 'дн.', weeks: 'нед.', months: 'мес.' };

/** Runs every night (setupTrigger) – can also be run by hand. */
function exportAll() {
  var config = readConfig_();
  var tables = fetchExport_(config).tables || {};
  var folder = exportFolder_(config.folderId);

  var name = FILE_PREFIX + ' ' + Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  var spreadsheet = SpreadsheetApp.create(name);
  DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);

  var sheets = buildSheets_(tables);
  sheets.forEach(function (sheet, i) {
    var target = i === 0 ? spreadsheet.getSheets()[0].setName(sheet.name) : spreadsheet.insertSheet(sheet.name);
    writeSheet_(target, sheet.header, sheet.rows);
  });

  removeOldExports_(folder);
}

/** Run once by hand: one daily trigger between 03:00 and 04:00 (Polish time), old ones removed first. */
function setupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'exportAll') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('exportAll').timeBased().everyDays(1).atHour(3).inTimezone(TIME_ZONE).create();
}

// ---------------------------------------------------------------- data

function readConfig_() {
  var props = PropertiesService.getScriptProperties();
  var config = {
    url: props.getProperty('SUPABASE_URL'),
    anonKey: props.getProperty('SUPABASE_ANON_KEY'),
    secret: props.getProperty('EXPORT_SECRET'),
    folderId: props.getProperty('DRIVE_FOLDER_ID'),
  };
  var missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'EXPORT_SECRET', 'DRIVE_FOLDER_ID'].filter(function (key, i) {
    return !config[['url', 'anonKey', 'secret', 'folderId'][i]];
  });
  if (missing.length) throw new Error('Mangler Script Properties: ' + missing.join(', '));
  config.url = config.url.replace(/\/+$/, '');
  return config;
}

/** POST /rest/v1/rpc/export_all – the secret goes in the body, never in the URL. */
function fetchExport_(config) {
  var response = UrlFetchApp.fetch(config.url + '/rest/v1/rpc/export_all', {
    method: 'post',
    contentType: 'application/json',
    // Only the apikey header: works with both the old anon key (JWT) and the new publishable key.
    headers: { apikey: config.anonKey },
    payload: JSON.stringify({ p_secret: config.secret }),
    muteHttpExceptions: true,
  });
  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('Eksporten feilet: HTTP ' + code + (code === 401 || code === 403 ? ' (feil EXPORT_SECRET?)' : ''));
  }
  return JSON.parse(response.getContentText());
}

/** The folder «Eksport» inside the folder from DRIVE_FOLDER_ID (found by id, never by name). */
function exportFolder_(folderId) {
  var parent = DriveApp.getFolderById(folderId);
  var existing = parent.getFoldersByName(EXPORT_FOLDER);
  return existing.hasNext() ? existing.next() : parent.createFolder(EXPORT_FOLDER);
}

/** Only files directly in «Eksport», named «LOA eksport…», older than 30 days. Never anything else. */
function removeOldExports_(folder) {
  var limit = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000);
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    if (file.getName().indexOf(FILE_PREFIX) === 0 && file.getDateCreated() < limit) file.setTrashed(true);
  }
}

// ---------------------------------------------------------------- sheets

/** The seven tabs in Russian, rows sorted so they are easy to read. */
function buildSheets_(t) {
  t = withoutDeletedClients_(t);
  var clients = t.clients || [];
  var visits = t.visits || [];
  var items = t.visit_items || [];
  var courses = t.treatment_courses || [];
  var types = t.procedure_types || [];
  var preparations = t.preparations || [];
  var zones = t.zones || [];

  var clientName = index_(clients, function (c) { return c.full_name; });
  var visitById = index_(visits, function (v) { return v; });
  var courseById = index_(courses, function (c) { return c; });
  var typeName = index_(types, function (p) { return localized_(p.name); });
  var zoneName = index_(zones, function (z) { return localized_(z.name); });
  var today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  var byClient = function (a, b) { return compare_(a[0], b[0]) || compare_(b[1] && iso_(b[1]), a[1] && iso_(a[1])); };

  var itemsByVisit = {};
  items.forEach(function (i) { (itemsByVisit[i.visit_id] = itemsByVisit[i.visit_id] || []).push(i); });
  var countBy = function (rows, key) {
    var n = {};
    rows.forEach(function (r) { n[r[key]] = (n[r[key]] || 0) + 1; });
    return n;
  };
  var stickers = countBy(t.visit_photos || [], 'visit_id');
  var prescriptions = countBy(t.course_photos || [], 'course_id');

  var sheets = [];

  sheets.push({
    name: 'Клиенты',
    header: ['Ф.И.О', 'Дата (первый визит)', 'Возраст при регистрации', 'Дата рождения', 'Телефон', 'E-mail', 'Страна', 'Город', 'Язык', 'Направление']
      .concat(ANAMNESIS_FIELDS.map(function (f) { return f.label; }))
      .concat(['Анамнез подтверждён', 'План процедур', 'Уход', 'Уход обновлён', 'Заметки', 'Создано', 'Изменено', 'ID клиента']),
    rows: clients.map(function (c) {
      var anamnesis = c.anamnesis || {};
      return [c.full_name, date_(c.card_date), c.age_at_registration, date_(c.birth_date), c.phone, c.email,
        country_(c.residence_country), c.residence_city, LANGUAGES_RU[c.language] || c.language,
        (c.direction || []).map(function (d) { return DIRECTIONS_RU[d] || d; }).join(', ')]
        .concat(ANAMNESIS_FIELDS.map(function (f) { return anamnesisValue_(f, anamnesis[f.key]); }))
        .concat([date_(c.anamnesis_confirmed_at), c.procedure_plan, c.care_text, date_(c.care_updated_at), c.notes,
          dateTime_(c.created_at), dateTime_(c.updated_at), c.id]);
    }).sort(function (a, b) { return compare_(a[0], b[0]); }),
  });

  sheets.push({
    name: 'Визиты',
    header: ['Клиент', 'Дата визита', 'Статус', 'Препараты', 'Заметки (только для врача)', 'Рекомендации после процедуры',
      'Язык рекомендаций', 'Схема лица', 'Фото наклейки', 'Архив: домашний уход', 'Архив: план процедур', 'Создано', 'Изменено', 'ID визита', 'ID клиента'],
    rows: visits.map(function (v) {
      var preps = (itemsByVisit[v.id] || []).sort(function (a, b) { return a.sort_order - b.sort_order; })
        .map(function (i) { return i.preparation_name + (i.quantity ? ' – ' + i.quantity : ''); });
      return [clientName[v.client_id], date_(v.visit_date), iso_(v.visit_date) > today ? 'Запланирован' : 'Проведён',
        preps.join('\n'), v.notes, v.recommendations, LANGUAGES_RU[v.recommendations_lang] || v.recommendations_lang,
        v.face_scheme ? 'есть' : '', stickers[v.id] || '', v.home_care_recommendations, v.procedure_plan,
        dateTime_(v.created_at), dateTime_(v.updated_at), v.id, v.client_id];
    }).sort(byClient),
  });

  sheets.push({
    name: 'Препараты в визитах',
    header: ['Клиент', 'Дата визита', 'Препарат', 'Тип процедуры', 'Количество', 'Порядок', 'ID визита'],
    rows: items.map(function (i) {
      var v = visitById[i.visit_id] || {};
      return [clientName[v.client_id], date_(v.visit_date), i.preparation_name, typeName[i.procedure_type_id], i.quantity, i.sort_order + 1, i.visit_id];
    }).sort(function (a, b) { return byClient(a, b) || a[5] - b[5]; }),
  });

  sheets.push({
    name: 'Курсы лечения',
    header: ['Клиент', 'Диагноз', 'Назначение', 'Начало', 'Окончание (примерно)', 'Контроль анализов', 'Последние анализы',
      'Статус', 'Завершён', 'Фото рецептов', 'Создано', 'ID курса'],
    rows: courses.map(function (c) {
      return [clientName[c.client_id], c.diagnosis, c.prescription, date_(c.start_date), date_(c.end_date),
        c.lab_interval_value ? 'каждые ' + number_(c.lab_interval_value) + ' ' + (UNITS_RU[c.lab_interval_unit] || c.lab_interval_unit) : '',
        date_(c.last_lab_date), c.status === 'completed' ? 'Завершён' : 'Активный', date_(c.completed_at),
        prescriptions[c.id] || '', dateTime_(c.created_at), c.id];
    }).sort(function (a, b) { return compare_(a[0], b[0]) || compare_(iso_(b[3]), iso_(a[3])); }),
  });

  var photoRows = [];
  (t.client_care_photos || []).forEach(function (p) {
    photoRows.push([clientName[p.client_id], 'Уход', '', p.storage_path, p.sort_order + 1, dateTime_(p.created_at)]);
  });
  (t.course_photos || []).forEach(function (p) {
    var c = courseById[p.course_id] || {};
    photoRows.push([clientName[c.client_id], 'Рецепт (курс лечения)', c.diagnosis, p.storage_path, '', dateTime_(p.created_at)]);
  });
  (t.visit_photos || []).forEach(function (p) {
    var v = visitById[p.visit_id] || {};
    photoRows.push([clientName[v.client_id], 'Фото наклейки (визит)', date_(v.visit_date), p.storage_path, p.sort_order + 1, dateTime_(p.created_at)]);
  });
  (t.client_photos || []).forEach(function (p) {
    var c = p.course_id ? courseById[p.course_id] || {} : null;
    photoRows.push([clientName[p.client_id], c ? 'Фото клиента (курс лечения)' : 'Фото клиента',
      (c ? c.diagnosis + ' · ' : '') + 'снято ' + date_(p.taken_on), p.storage_path, '', dateTime_(p.created_at)]);
  });
  sheets.push({
    name: 'Уход и фото',
    header: ['Клиент', 'Вид', 'К чему относится', 'Файл (только имя, без содержимого)', 'Порядок', 'Добавлено'],
    rows: photoRows.sort(function (a, b) { return compare_(a[0], b[0]) || compare_(a[1], b[1]); }),
  });

  sheets.push({
    name: 'Документы',
    header: ['Клиент', 'Название', 'Дата документа', 'Курс лечения', 'Тип файла', 'Размер, КБ', 'Файл (только имя, без содержимого)', 'Загружено'],
    rows: (t.client_documents || []).map(function (d) {
      return [clientName[d.client_id], d.title, date_(d.document_date), d.course_id ? (courseById[d.course_id] || {}).diagnosis : '',
        d.mime_type, d.size_bytes ? Math.round(d.size_bytes / 1024) : '', d.storage_path, dateTime_(d.created_at)];
    }).sort(function (a, b) { return compare_(a[0], b[0]) || compare_(iso_(b[2]), iso_(a[2])); }),
  });

  var zonesByType = {};
  (t.procedure_type_zones || []).forEach(function (z) {
    (zonesByType[z.procedure_type_id] = zonesByType[z.procedure_type_id] || []).push(zoneName[z.zone_id]);
  });
  var catalogRow = function (type, prep) {
    var s = prep || type;
    return [localized_(type.name), type.code, prep ? prep.name : '— настройки типа —', prep ? prep.manufacturer : '',
      prep && prep.favorite ? '★' : '', join_([s.dose_text, s.dose_unit], ' '), range_(s.course_min, s.course_max, ''),
      range_(s.interval_min, s.interval_max, s.interval_unit),
      s.maintenance_as_needed ? 'по показаниям' : range_(s.maintenance_min, s.maintenance_max, s.maintenance_unit),
      s.control_after_days, s.advice ? s.advice.ru : '', prep ? '' : (zonesByType[type.id] || []).join(', '),
      s.active === false ? 'нет' : 'да'];
  };
  var catalogRows = [];
  types.slice().sort(function (a, b) { return a.sort_order - b.sort_order; }).forEach(function (type) {
    catalogRows.push(catalogRow(type, null));
    preparations.filter(function (p) { return p.procedure_type_id === type.id; })
      .sort(function (a, b) { return compare_(a.name, b.name); })
      .forEach(function (p) { catalogRows.push(catalogRow(type, p)); });
  });
  sheets.push({
    name: 'Каталог',
    header: ['Тип процедуры', 'Код', 'Препарат', 'Производитель', 'Избранное', 'Доза', 'Курс (процедур)', 'Интервал',
      'Поддерживающая', 'Контроль через, дней', 'Рекомендации (ru)', 'Зоны', 'Активен'],
    rows: catalogRows,
  });

  return sheets;
}

/** PR6: clients in «Удалённые клиенты» (deleted_at set) and everything of theirs are left out. */
function withoutDeletedClients_(t) {
  var gone = {};
  (t.clients || []).forEach(function (c) { if (c.deleted_at) gone[c.id] = true; });
  var keep = function (rows, key) { return (rows || []).filter(function (r) { return !gone[r[key]]; }); };
  var visits = keep(t.visits, 'client_id');
  var courses = keep(t.treatment_courses, 'client_id');
  var visitIds = {};
  visits.forEach(function (v) { visitIds[v.id] = true; });
  var courseIds = {};
  courses.forEach(function (c) { courseIds[c.id] = true; });
  var copy = {};
  Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
  copy.clients = (t.clients || []).filter(function (c) { return !c.deleted_at; });
  copy.visits = visits;
  copy.treatment_courses = courses;
  copy.visit_items = (t.visit_items || []).filter(function (i) { return visitIds[i.visit_id]; });
  copy.visit_photos = (t.visit_photos || []).filter(function (p) { return visitIds[p.visit_id]; });
  copy.course_photos = (t.course_photos || []).filter(function (p) { return courseIds[p.course_id]; });
  copy.client_care_photos = keep(t.client_care_photos, 'client_id');
  copy.client_photos = keep(t.client_photos, 'client_id');
  copy.client_documents = keep(t.client_documents, 'client_id');
  return copy;
}

/** Plain text everywhere (so «+48 …» never turns into a formula), bold frozen header. */
function writeSheet_(sheet, header, rows) {
  var values = [header].concat(rows).map(function (row) {
    return header.map(function (_, i) {
      var v = row[i];
      if (v === null || v === undefined) return '';
      v = String(v);
      return v.length > MAX_CELL ? v.slice(0, MAX_CELL - 1) + '…' : v;
    });
  });
  var range = sheet.getRange(1, 1, values.length, header.length);
  range.setNumberFormat('@');
  range.setValues(values);
  sheet.getRange(1, 1, 1, header.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// ---------------------------------------------------------------- formatting

/** {choices: [...], text} → «сухая, чувствительная; ?» */
function anamnesisValue_(field, value) {
  if (!value) return '';
  var choices = (value.choices || []).map(function (c) { return (field.options && field.options[c]) || c; }).join(', ');
  return join_([choices, value.text], '; ');
}

/** 2026-10-28 or 2026-10-28T…→ 28.10.2026 */
function date_(value) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
}

function dateTime_(value) {
  return value ? Utilities.formatDate(new Date(value), TIME_ZONE, 'dd.MM.yyyy HH:mm') : '';
}

function iso_(value) {
  var m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value || '');
  return m ? m[3] + '-' + m[2] + '-' + m[1] : String(value || '');
}

function country_(code) {
  if (!code) return '';
  try {
    var name = new Intl.DisplayNames(['ru'], { type: 'region' }).of(code);
    if (name && name !== code) return name;
  } catch (e) {
    // Intl.DisplayNames is not available everywhere – use the list above.
  }
  return COUNTRIES_RU[code] || code;
}

function localized_(name) {
  return name ? name.ru || name.uk || name.pl || name.en || '' : '';
}

function range_(min, max, unit) {
  if (min === null || min === undefined) return '';
  var text = max !== null && max !== undefined && max !== min ? min + '–' + max : String(min);
  return join_([text, UNITS_RU[unit] || unit], ' ');
}

function number_(value) {
  return String(value).replace('.', ',');
}

function join_(parts, separator) {
  return parts.filter(function (p) { return p !== null && p !== undefined && p !== ''; }).join(separator);
}

function index_(rows, pick) {
  var map = {};
  rows.forEach(function (r) { map[r.id] = pick(r); });
  return map;
}

function compare_(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ru');
}
