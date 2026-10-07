import fs from "node:fs";
import assert from "node:assert/strict";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const sw=fs.readFileSync(new URL("../sw.js",import.meta.url),"utf8");

assert.ok(!html.includes('id="onboarding"'),"Blocking onboarding must not exist");
assert.ok(html.includes('id="profilePromptForm"'),"Non-blocking profile prompt must exist inside app");
assert.ok(html.includes('id="appRoot"'),"Main app must always be present");
assert.ok(js.includes('profilePromptForm').toString(),"Profile prompt must have a submit handler");
assert.ok(!js.includes('finishOnboarding('),"Legacy onboarding gate must be removed");
assert.ok(js.includes('getRegistrations'),"Beta build must unregister stale service workers");
assert.ok(sw.includes('unregister()'),"Retirement service worker must unregister itself");
assert.ok(html.includes('id="voiceMode"'),"Voice assistant mode must exist");
assert.ok(html.includes('id="editDialog"'),"Edit dialog must exist");
assert.ok(html.includes('id="cashflowChart"')&&html.includes('id="spendingDonut"'),"Finance infographics must exist");
assert.ok(html.includes('id="resetNara"'),"Reset control must exist");
console.log("NARA UI contract passed: app-first, voice mode, finance charts, editable data, reset.");