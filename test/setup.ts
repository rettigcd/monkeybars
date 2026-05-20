import { afterEach, vi } from "vitest";

// clear timers so test pass faster???
// -- better to not start timers / intervals on import
afterEach(() => { vi.restoreAllMocks(); });

vi.spyOn(globalThis, "setInterval");
vi.spyOn(globalThis, "setTimeout");
vi.spyOn(globalThis, "clearInterval");
vi.spyOn(globalThis, "clearTimeout");

// somehow, this command sometimes causes it to return in normal time
process.on("beforeExit", () => {
	console.log("setInterval:", vi.mocked(setInterval).mock.calls);
	console.log("setTimeout:", vi.mocked(setTimeout).mock.calls);
});
