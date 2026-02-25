/**
 * ControlsWaiter tests
 *
 * @author CyberChef contributors
 * @copyright Crown Copyright 2026
 * @license Apache-2.0
 */

import assert from "assert";
import it from "../assertionHandler.mjs";
import ControlsWaiter from "../../../src/web/waiters/ControlsWaiter.mjs";
import TestRegister from "../../lib/TestRegister.mjs";

/**
 * Build a minimal mock app and manager for ControlsWaiter construction.
 *
 * @returns {{ app: object, manager: object, alertCalls: string[] }}
 */
function buildMocks() {
    const alertCalls = [];
    const app = {
        alert: (msg) => alertCalls.push(msg),
    };
    const manager = {};
    return { app, manager, alertCalls };
}

/**
 * Stub the browser globals that exportClick relies on and return a
 * restore function that puts the originals back.
 *
 * @param {object} [overrides] - Optional overrides for individual stubs.
 * @returns {{ anchors: object[], restore: Function }}
 */
function stubBrowserGlobals(overrides = {}) {
    const origLocalStorage  = global.localStorage;
    const origDocument      = global.document;
    const origURL           = global.URL;
    const origBlob          = global.Blob;

    const anchors = [];

    global.localStorage = overrides.localStorage ?? {
        getItem: () => '[{"id":1,"name":"Test Recipe","recipe":"To Base64"}]',
    };

    global.document = overrides.document ?? {
        createElement: (tag) => {
            const el = { tag, href: "", download: "", click: () => {} };
            anchors.push(el);
            return el;
        },
        body: {
            appendChild:  () => {},
            removeChild:  () => {},
        },
    };

    global.URL = overrides.URL ?? {
        createObjectURL: () => "blob:mock-url",
        revokeObjectURL: () => {},
    };

    // Minimal Blob stub that exposes the content for assertions
    global.Blob = overrides.Blob ?? class MockBlob {
        constructor(parts, options) {
            this.parts   = parts;
            this.type    = options?.type ?? "";
        }
    };

    const restore = () => {
        global.localStorage  = origLocalStorage;
        global.document      = origDocument;
        global.URL           = origURL;
        global.Blob          = origBlob;
    };

    return { anchors, restore };
}

TestRegister.addApiTests([

    it("ControlsWaiter: exportClick calls app.alert with the correct filename", () => {
        const { app, manager, alertCalls } = buildMocks();
        const { restore } = stubBrowserGlobals();
        try {
            const waiter = new ControlsWaiter(app, manager);
            waiter.exportClick();
            assert.strictEqual(alertCalls.length, 1, "app.alert should be called exactly once");
            assert.strictEqual(
                alertCalls[0],
                'Recipe downloaded as "CyberChefExport.json".',
                "app.alert message should contain the correct filename"
            );
        } finally {
            restore();
        }
    }),

    it("ControlsWaiter: exportClick sets the anchor download attribute to CyberChefExport.json", () => {
        const { app, manager } = buildMocks();
        const { anchors, restore } = stubBrowserGlobals();
        try {
            const waiter = new ControlsWaiter(app, manager);
            waiter.exportClick();
            assert.strictEqual(anchors.length, 1, "one anchor element should be created");
            assert.strictEqual(
                anchors[0].download,
                "CyberChefExport.json",
                "anchor download attribute should be 'CyberChefExport.json'"
            );
        } finally {
            restore();
        }
    }),

    it("ControlsWaiter: exportClick creates a Blob with the savedRecipes content", () => {
        const { app, manager } = buildMocks();
        const createdBlobs = [];
        const { restore } = stubBrowserGlobals({
            Blob: class MockBlob {
                constructor(parts, options) {
                    this.parts  = parts;
                    this.type   = options?.type ?? "";
                    createdBlobs.push(this);
                }
            },
        });
        const recipeData = '[{"id":1,"name":"Test Recipe","recipe":"To Base64"}]';
        global.localStorage = { getItem: () => recipeData };
        try {
            const waiter = new ControlsWaiter(app, manager);
            waiter.exportClick();
            assert.strictEqual(createdBlobs.length, 1, "one Blob should be created");
            assert.strictEqual(
                createdBlobs[0].parts[0],
                recipeData,
                "Blob should contain the savedRecipes string"
            );
            assert.strictEqual(
                createdBlobs[0].type,
                "application/json",
                "Blob MIME type should be application/json"
            );
        } finally {
            restore();
        }
    }),

    it("ControlsWaiter: exportClick revokes the object URL after the download is triggered", () => {
        const { app, manager } = buildMocks();
        const revokedUrls = [];
        const { restore } = stubBrowserGlobals({
            URL: {
                createObjectURL: () => "blob:test-url",
                revokeObjectURL: (url) => revokedUrls.push(url),
            },
        });
        try {
            const waiter = new ControlsWaiter(app, manager);
            waiter.exportClick();
            assert.strictEqual(revokedUrls.length, 1, "revokeObjectURL should be called once");
            assert.strictEqual(revokedUrls[0], "blob:test-url", "the correct URL should be revoked");
        } finally {
            restore();
        }
    }),

]);
