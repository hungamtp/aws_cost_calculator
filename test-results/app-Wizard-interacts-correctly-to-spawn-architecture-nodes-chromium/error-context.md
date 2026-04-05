# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> Wizard interacts correctly to spawn architecture nodes
- Location: e2e/app.spec.ts:12:5

# Error details

```
Error: Channel closed
```

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for locator('nav button').nth(1)
    - locator resolved to <button class="p-2 rounded-lg transition-colors text-gray-500 hover:text-white">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <p class="text-gray-400 text-sm mb-6">Describe your workload and automatically generate…</p> from <div class="absolute top-0 left-[60px] bottom-0 w-[400px] bg-gray-900 border-r border-gray-800 shadow-2xl transition-transform duration-300 z-20 overflow-y-auto px-6 py-8 -translate-x-full">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <p class="text-gray-400 text-sm mb-6">Describe your workload and automatically generate…</p> from <div class="absolute top-0 left-[60px] bottom-0 w-[400px] bg-gray-900 border-r border-gray-800 shadow-2xl transition-transform duration-300 z-20 overflow-y-auto px-6 py-8 -translate-x-full">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    51 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <p class="text-gray-400 text-sm mb-6">Describe your workload and automatically generate…</p> from <div class="absolute top-0 left-[60px] bottom-0 w-[400px] bg-gray-900 border-r border-gray-800 shadow-2xl transition-transform duration-300 z-20 overflow-y-auto px-6 py-8 -translate-x-full">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

```

```
Error: browserContext.close: Target page, context or browser has been closed
```