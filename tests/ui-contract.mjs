import fs from "node:fs";
import assert from "node:assert/strict";

const html=fs.readFileSync(new URL("../index.html",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../styles.css",import.meta.url),"utf8");
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
assert.ok(js.includes("scrollChatToBottom"),"Chat must keep the newest reply above the composer");
assert.ok(css.includes("--chat-safe-bottom")||css.includes("scroll-padding-bottom"),"Chat must reserve a safe area above composer");
assert.ok(html.includes('id="conversationScroll"'),"Intro and messages must share one scroll surface");
assert.ok(js.includes('$("#conversationScroll")'),"Chat auto-scroll must target the conversation surface");
assert.ok(html.includes("Powered by <b>HDRG Creative Partner</b>"),"Account footer branding must exist");
assert.ok(css.includes("overflow-x:hidden"),"Mobile pages must not overflow horizontally");
assert.ok(css.includes("#page-chat .profile-prompt")&&css.includes("display:grid!important"),"Profile prompt must remain a grid on mobile");
assert.ok(css.includes("#page-chat .chips")&&css.includes("flex-wrap:nowrap!important"),"Prompt chips must stay single-row horizontal scroll");
assert.ok(css.includes(".chat-actions"),"Assistant clarification choices must wrap responsively");
console.log("NARA UI contract passed: smart choices, responsive wrap, scrollable intro, fixed composer, account footer and editable data.");