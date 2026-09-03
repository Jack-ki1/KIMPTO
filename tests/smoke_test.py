"""
KIMPTO — automated smoke test suite
=====================================
Exercises the app end-to-end in a real headless browser: theme switching,
the customization console, engine tabs, input validation, error handling,
and localStorage persistence across a reload.

SETUP (one-time):
    pip install playwright
    playwright install chromium

RUN (from the project root, i.e. the folder this file's parent sits in):
    python3 -m http.server 8080 &
    python3 tests/smoke_test.py
    # then stop the server: kill %1   (or Ctrl+C the terminal running it)

You can point it at a different URL (e.g. your live GitHub Pages deployment)
with an environment variable instead of a local server:
    KIMPTO_URL="https://yourname.github.io/kimpto/index.html" python3 tests/smoke_test.py

Exits with code 0 if every check passes, 1 if anything fails — safe to wire
into a pre-commit hook or a CI job.
"""

import os
import sys
import traceback

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("KIMPTO_URL", "http://localhost:8080/index.html")

results = []


def check(name, fn):
    try:
        fn()
        results.append((name, True, None))
        print(f"  PASS  {name}")
    except Exception as exc:
        results.append((name, False, str(exc)))
        print(f"  FAIL  {name}\n        {exc}")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page_errors = []

        def on_page_error(exc):
            page_errors.append(str(exc))

        page = browser.new_page()
        page.on("pageerror", on_page_error)
        page.goto(BASE_URL, wait_until="networkidle", timeout=15000)

        print(f"\nTesting {BASE_URL}\n")

        check("page title mentions Kimpto",
              lambda: (_ for _ in ()).throw(AssertionError("title mismatch")) if "Kimpto" not in page.title() else None)

        check("default theme is graphite",
              lambda: _assert_eq(page.eval_on_selector("html", "el => el.getAttribute('data-theme')"), "graphite"))

        check("theme menu lists exactly 4 themes",
              lambda: _assert_eq(_open_theme_menu_and_count(page), 4))

        check("switching to Aurora updates data-theme",
              lambda: _assert_eq(_switch_theme(page, "Aurora"), "aurora"))

        check("console drawer opens and shows 3 groups",
              lambda: _assert_console_opens(page))

        check("console reports 12 top-level customization fields",
              lambda: _assert_console_field_count(page))

        check("creativity slider updates its live value label",
              lambda: _assert_creativity_slider(page))

        check("closing the console removes the open state",
              lambda: _close_console(page))

        check("engine tabs show/hide the correct panel",
              lambda: _assert_engine_tabs(page))

        check("character counter tracks the task input",
              lambda: _assert_char_count(page))

        check("generating with an empty task shows an inline error (no crash)",
              lambda: _assert_empty_task_error(page))

        check("settings persist across a page reload",
              lambda: _assert_persistence(page))

        check("no uncaught JS exceptions occurred during the run",
              lambda: _assert_eq(page_errors, []))

        browser.close()

    print("\n" + "-" * 50)
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"{passed}/{total} checks passed")
    if passed != total:
        print("\nFailures:")
        for name, ok, err in results:
            if not ok:
                print(f"  - {name}: {err}")
        sys.exit(1)
    sys.exit(0)


# ---- individual check bodies ----

def _assert_eq(a, b):
    if a != b:
        raise AssertionError(f"expected {b!r}, got {a!r}")


def _open_theme_menu_and_count(page):
    page.click("#themeBtn")
    page.wait_for_selector(".theme-menu.open")
    return page.eval_on_selector_all(".theme-menu button", "els => els.length")


def _switch_theme(page, label):
    page.evaluate(f"""() => {{
        const btns = [...document.querySelectorAll('.theme-menu button')];
        btns.find(b => b.textContent.includes('{label}')).click();
    }}""")
    page.wait_for_timeout(150)
    return page.eval_on_selector("html", "el => el.getAttribute('data-theme')")


def _assert_console_opens(page):
    page.click("#consoleBtn")
    page.wait_for_timeout(200)
    is_open = page.eval_on_selector("#console", "el => el.classList.contains('open')")
    group_count = page.eval_on_selector_all(".console-group-title", "els => els.length")
    if not is_open:
        raise AssertionError("console did not open")
    if group_count != 3:
        raise AssertionError(f"expected 3 groups (Output/Engine tuning/Interface), got {group_count}")


def _assert_console_field_count(page):
    # 12 top-level fields + 2 conditional (custom language, auto-copy target) when both are inactive
    count = page.eval_on_selector_all(".console-field", "els => els.length")
    if count < 12:
        raise AssertionError(f"expected at least 12 console-field elements, got {count}")


def _assert_creativity_slider(page):
    page.evaluate("""() => {
        const s = document.getElementById('cCreativity');
        s.value = '0.4';
        s.dispatchEvent(new Event('input', { bubbles: true }));
    }""")
    val = page.eval_on_selector("#cCreativityVal", "el => el.textContent")
    _assert_eq(val, "0.4")


def _close_console(page):
    page.click("#consoleClose")
    page.wait_for_timeout(200)
    is_open = page.eval_on_selector("#console", "el => el.classList.contains('open')")
    if is_open:
        raise AssertionError("console did not close")


def _assert_engine_tabs(page):
    free_visible = page.eval_on_selector("#freePanel", "el => getComputedStyle(el).display !== 'none'")
    key_visible = page.eval_on_selector("#keyPanel", "el => getComputedStyle(el).display !== 'none'")
    if not free_visible or key_visible:
        raise AssertionError("Free panel should be visible by default, My Key panel hidden")
    page.click("#tabKey")
    page.wait_for_timeout(100)
    key_visible_after = page.eval_on_selector("#keyPanel", "el => getComputedStyle(el).display !== 'none'")
    if not key_visible_after:
        raise AssertionError("My Key panel did not become visible after clicking its tab")
    page.click("#tabFree")  # leave it back on Free for later checks


def _assert_char_count(page):
    page.fill("#taskInput", "hello world")
    text = page.eval_on_selector("#charCount", "el => el.textContent")
    _assert_eq(text, "11 characters")
    page.fill("#taskInput", "")  # reset for the next check


def _assert_empty_task_error(page):
    page.click("#generateBtn")
    page.wait_for_timeout(300)
    shown = page.eval_on_selector("#errorBanner", "el => el.classList.contains('show')")
    text = page.eval_on_selector("#errorBanner", "el => el.textContent")
    if not shown or "Describe the task" not in text:
        raise AssertionError(f"expected the empty-task validation error, got shown={shown} text={text!r}")


def _assert_persistence(page):
    page.evaluate("""() => {
        const btn = document.getElementById('themeBtn');
        btn.click();
    }""")
    page.wait_for_selector(".theme-menu.open")
    page.evaluate("""() => {
        const btns = [...document.querySelectorAll('.theme-menu button')];
        btns.find(b => b.textContent.includes('Phosphor')).click();
    }""")
    page.wait_for_timeout(150)
    page.reload(wait_until="networkidle")
    theme_after_reload = page.eval_on_selector("html", "el => el.getAttribute('data-theme')")
    _assert_eq(theme_after_reload, "phosphor")


if __name__ == "__main__":
    run()
