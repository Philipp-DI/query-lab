import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from playwright.sync_api import sync_playwright
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')
OUT = os.environ.get('SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shots'))
os.makedirs(OUT, exist_ok=True)
BASE = 'http://local.test/'
errors = []
def serve(route):
    name = route.request.url.replace(BASE, '').split('?')[0] or 'test.html'
    p = os.path.join(DIST, name)
    if os.path.exists(p):
        route.fulfill(path=p, content_type='text/html' if p.endswith('.html') else 'application/javascript')
    else:
        route.abort()
def new_page(browser, **kw):
    ctx = browser.new_context(**kw)
    ctx.route('http://local.test/**', serve)
    ctx.route(lambda u: not u.startswith(BASE), lambda r: r.abort())
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') and 'ERR_FAILED' not in m.text else None)
    page.on('pageerror', lambda e: errors.append(f'[pageerror] {e}'))
    page.goto(BASE + 'test.html')
    page.wait_for_selector('#boot', state='detached', timeout=40000)
    page.wait_for_timeout(700)
    return page
def txt(page, sel, n=260):
    el = page.query_selector(sel)
    return (el.inner_text() if el else '<missing>').replace('\n', ' | ')[:n]
def editor(page, sql, run=False):
    page.click('#ed-ta'); page.keyboard.press('Control+A'); page.keyboard.press('Delete')
    page.fill('#ed-ta', sql)
    page.dispatch_event('#ed-ta', 'input')
    if run:
        page.click('#ed-ta'); page.keyboard.press('Control+Enter'); page.wait_for_timeout(350)
def toasts(page):
    return ' || '.join(t.inner_text() for t in page.query_selector_all('.toast'))[:300]

with sync_playwright() as p:
    b = p.chromium.launch()
    page = new_page(b, viewport={'width': 1440, 'height': 900})
    print('TRACKS:', [t.inner_text() for t in page.query_selector_all('#side-learn h3.track')])
    # ---- 2NF lesson, multi-select choice
    page.click('#side-learn [data-lesson="nf2"]'); page.wait_for_timeout(400)
    print('DS:', txt(page, '#ds-name'), '| TOAST:', toasts(page))
    print('LESSON:', txt(page, '#side-learn .lesson-title'), '| head:', txt(page, '#ex-card .ex-head'))
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(200)
    print('EMPTY:', txt(page, '#ex-card .fb'))
    page.check('#ex-card [data-choice="0"]'); page.check('#ex-card [data-choice="1"]')
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(200)
    print('PARTIAL:', txt(page, '#ex-card .fb'))
    page.check('#ex-card [data-choice="2"]'); page.check('#ex-card [data-choice="3"]')
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(200)
    print('TOO MANY:', txt(page, '#ex-card .fb'))
    page.uncheck('#ex-card [data-choice="3"]')
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(300)
    print('RIGHT:', txt(page, '#ex-card .fb'), '| right marks:', len(page.query_selector_all('#ex-card .choice.right')))
    page.screenshot(path=f'{OUT}/d1-choice.png')
    # ---- 2NF exercise 2, built step by step in the live database
    page.click('#ex-card [data-act="next"]'); page.wait_for_timeout(400)
    print('MODE editor:', page.get_attribute('#mode-editor', 'aria-pressed') or page.get_attribute('#mode-editor', 'aria-selected'))
    print('EXPECTED BTN:', bool(page.query_selector('#ex-card [data-act="expected"]')))
    editor(page, 'CREATE TABLE students (\n  id   INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);', run=True)
    print('RUN 1:', txt(page, '#res-body', 120))
    editor(page, 'INSERT INTO students (id, name)\nSELECT DISTINCT student_id, student_name FROM enrollments;')
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(400)
    print('CHECK BEFORE RUN:', txt(page, '#ex-card .fb', 320))
    editor(page, 'SELECT COUNT(*) AS n FROM students;', run=True)
    print('LIVE COUNT after probe (want 0):', txt(page, '#res-body table.grid tbody', 40))
    editor(page, 'INSERT INTO students (id, name)\nSELECT DISTINCT student_id, student_name FROM enrollments;')
    page.click('#ed-ta'); page.keyboard.press('Control+Enter'); page.wait_for_timeout(350)
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(400)
    print('CHECK AFTER RUN:', txt(page, '#ex-card .fb', 320))
    print('RESULT TABS:', txt(page, '#res-head', 200))
    page.screenshot(path=f'{OUT}/d2-live-check.png')
    # ---- re-running the whole script explains the error
    editor(page, 'CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL);\nINSERT INTO students (id, name) SELECT DISTINCT student_id, student_name FROM enrollments;', run=True)
    print('RERUN ERROR:', txt(page, '#res-body', 420))
    # ---- 2NF exercise 3: complete script, checked on a fresh copy
    page.click('#ex-card [data-act="next"]'); page.wait_for_timeout(400)
    print('TOAST nf2-3:', toasts(page))
    editor(page, "CREATE TABLE courses (id TEXT PRIMARY KEY, title TEXT, teacher TEXT);\nINSERT INTO courses SELECT DISTINCT course_id, course_title, teacher FROM enrollments;")
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(400)
    print('CHECK nf2-3:', txt(page, '#ex-card .fb', 200), '| tabs:', txt(page, '#res-head', 160))
    # ---- 2NF exercise 4 with a typical mistake
    page.click('#ex-card [data-act="next"]'); page.wait_for_timeout(400)
    print('TOAST nf2-4:', toasts(page))
    editor(page, "CREATE TABLE grades (student_id INTEGER REFERENCES students(id), course_id TEXT REFERENCES courses(id), student_name TEXT, score INTEGER, PRIMARY KEY (student_id, course_id));\nINSERT INTO grades SELECT student_id, course_id, student_name, score FROM enrollments;")
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(400)
    print('CHECK nf2-4 wrong:', txt(page, '#ex-card .fb', 260))
    page.screenshot(path=f'{OUT}/d3-fail.png')
    # ---- 3NF: single choice, wrong pick, then reveal
    page.click('#side-learn [data-act="back"]'); page.wait_for_timeout(200)
    page.click('#side-learn [data-lesson="nf3"]'); page.wait_for_timeout(400)
    page.check('#ex-card [data-choice="1"]')
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(200)
    print('SINGLE WRONG:', txt(page, '#ex-card .fb'), '| wrong marks:', len(page.query_selector_all('#ex-card .choice.wrong')))
    page.click('#ex-card [data-act="reveal"]'); page.wait_for_timeout(200)
    print('REVEAL:', txt(page, '#ex-card .fb'), '| right:', [e.inner_text() for e in page.query_selector_all('#ex-card .choice.right')], '| reveal btn gone:', not page.query_selector('#ex-card [data-act="reveal"]'))
    page.keyboard.press('Tab')
    page.screenshot(path=f'{OUT}/d4-reveal.png')
    # ---- setup tables come back after a reset
    page.click('#side-learn .ex-dot[data-ex="2"]'); page.wait_for_timeout(400)
    print('TOAST nf3-3:', toasts(page))
    print('HAS departments:', bool(page.query_selector('#schema-body .titem[data-t="departments"]')))
    page.click('#ds-btn'); page.wait_for_timeout(150); page.click('#ds-menu [data-menu="reset"]'); page.wait_for_timeout(400)
    print('AFTER RESET departments:', bool(page.query_selector('#schema-body .titem[data-t="departments"]')))
    # ---- transactions: textAsserts
    page.click('#side-learn [data-act="back"]'); page.wait_for_timeout(200)
    page.click('#side-learn [data-lesson="tx"]'); page.wait_for_timeout(400)
    page.check('#ex-card [data-choice="0"]'); page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(200)
    print('TX-1:', txt(page, '#ex-card .fb', 120))
    page.click('#ex-card [data-act="next"]'); page.wait_for_timeout(400)
    editor(page, "UPDATE orders SET status = 'cancelled' WHERE id = 242;")
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(400)
    print('TX-2 no BEGIN:', txt(page, '#ex-card .fb', 200))
    editor(page, "BEGIN;\nUPDATE orders SET status = 'cancelled' WHERE id = 242;\nUPDATE products SET stock = stock + (SELECT quantity FROM order_items WHERE order_id = 242 AND product_id = products.id) WHERE id IN (SELECT product_id FROM order_items WHERE order_id = 242);\nCOMMIT;")
    page.click('#ex-card [data-act="check"]'); page.wait_for_timeout(400)
    print('TX-2 ok:', txt(page, '#ex-card .fb', 160), '| tabs:', txt(page, '#res-head', 160))
    # live transaction run marks the database as changed only after COMMIT
    page.click('#ed-ta'); page.keyboard.press('Control+Enter'); page.wait_for_timeout(350)
    print('DIRTY chip after commit:', txt(page, '.ds-dirty', 60))
    page.screenshot(path=f'{OUT}/d5-tx.png')
    # ---- choice exercises on a phone: the strip sends people to the lesson
    pp = new_page(b, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pp.click('#btn-learn'); pp.wait_for_timeout(400)
    pp.click('#side-learn [data-lesson="anomalies"]'); pp.wait_for_timeout(500)
    print('PHONE drawer open:', pp.is_visible('#side-learn'))
    pp.screenshot(path=f'{OUT}/d6-phone-anomalies.png')
    pp.click('#side-learn .ex-dot[data-ex="1"]'); pp.wait_for_timeout(300)
    pp.check('#ex-card [data-choice="1"]'); pp.click('#ex-card [data-act="check"]'); pp.wait_for_timeout(300)
    print('PHONE choice:', txt(pp, '#ex-card .fb', 120))
    ov = pp.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    print('PHONE overflow:', ov)
    pp.screenshot(path=f'{OUT}/d7-phone-choice.png')
    b.close()
print('\nERRORS:', json.dumps(errors, indent=1) if errors else 'none')
