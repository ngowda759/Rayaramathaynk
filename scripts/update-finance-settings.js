"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-require-imports */
var app_1 = require("firebase-admin/app");
var firestore_1 = require("firebase-admin/firestore");
function updateFinanceSettings() {
    return __awaiter(this, void 0, void 0, function () {
        var privateKey, serviceAccount, db, settingsDoc, financeSettings, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCrryMVL/BrePgi\ne7L3yTRr6sr8OnGdqvF7ah11JO1aOS++eCsT09V30+Q+KMbswMk5zzdnuia77P/3\ngi5oZdLL1erfYT6Pm1VQpQ0UIF9UC5FeQMo1/rzqOxndCohEeAbFtwJ09VjaRx2t\nAHs3aJHeJPki7kvFeT246TunxElngREwVRyJ7rZapjl6f8Zh9bJkd2z7IhkcF8EZ\nSzEQxQ4+qMU0DUxTlImpkIbe7BQmBEVGszpCRpdnZ8uG6R+y4bIC2zzBLdmsl50p\nurz5fWt3zXp+BSrEHzQ4CmExPfHUPFsmUj+zJUispHkL11h09L+hlEAxvyywQnnw\n40JUm5VhAgMBAAECggEAKuQ9Woy4ftEhBNRsmNUOoKtu/ObI/b/4RoHzTBHmrnS9\nBdPVx0VT/nTUf+cGE53yZ9vqFqL+DFMge8BtQa22pTATVq1fyNbg0J37j3yq9D9T\nmP2Mx0KWBdqwEnYQJzLpVjnrhjbJdPbxZghJwEUCtEH+cAiiq3onvmueeMJkKFRA\nqQiRZe3qdnAv0Pdc4fJsHAVsDxIUOlwobUa75KMYxEBaccBGpopYkf5Y3JutH4bE\n3HKawW2QKFzDMVrZmoXCfDxvggPhGLEfA7lhVM+yHAzhUC50Y2gvGjLNOMw/Ordf\nGCCXNAogiLcQToNk9xIHgWSl51u0Tpvd8kc004NgcQKBgQDUhDdt0/GsS6IVaRxH\ndO2rZQFrXJenIlg+ajb5N8K+706lX3jpR4iZhnKIRYibez2/VQ0bOng/bauBao/n\nCL/AucKlKA8qMRa+/BJ1rlQGF+9vjhaU9ynnrWg1CBzlts+IZwF52YIAXS3zfFjU\nw7zp3S6ARt1EimBAEtW5dUga7QKBgQDO0Bbz0+DrqF/m0j/tashr1wTt3SyoqWQn\n1bo3s3/nSBRlEA+6o9YKbkc+RIK7HWKnOoDHzK7oOtPL7jEd8AyBkelsg+l95LIT\nz36D5M+yRhmnuqJaa045yeFtWe+PgCdjkjZH+XtvKsXTGoOap04nTLiQ9smFS6QE\n9GDCwmWxxQKBgQCvJCP2TJTAtThoQs7+iPwSo9SOoamOIXzuO2UA8RZ7eweqvMsO\nHlkShb5AVmXmFaRm2fZKOV6+j2in6KWd9xTpBW7H5ALTd89SKLYh7EDtIK7Ali5A\nKI6Nk9js07nVC1twA8wwmrRMDn7/Srx+5K39Yr6fE0fp48y9IYioJmL9ZQKBgQC8\nf1N8N1DY2aVXR6i2p043ZEp81ss+iu3blOTeof9g+QSFvKbpcSzEYxESQvV4wGbL\njvoToY6F4iBqzhX8eG+dpTVBD9ZARbK9dbCVXHalwVje1K/ng8hPyZ5qwb8kZyT/\njyNkZJLJlw2pxI/Q5M7J6RaMIjM5B+FeFrMesHpqFQKBgQDRHofHt0uyDmiKMlgW\nSew3chIXFwkhDz4LyYJWSsia15TeaB2MQdJAxlqqr02Mz7Tp6HFRIer8KjH9PNFz\nXRqd7UonUevdW58l2K7QUbqGX6EV+XAEW4+BO76m9DNlMEuZcBJhBpBCZt8abGxp\nvwHm2b//G+nR0ivqDn1UYeA67A==\n-----END PRIVATE KEY-----";
                    serviceAccount = {
                        type: "service_account",
                        project_id: "sri-raghavendra-mutt",
                        private_key_id: "9f5e950d788ea927d8ef01a18b3d115a239a152a",
                        private_key: privateKey,
                        client_email: "firebase-adminsdk-fbsvc@sri-raghavendra-mutt.iam.gserviceaccount.com",
                        client_id: "123456789",
                        auth_uri: "https://accounts.google.com/o/oauth2/auth",
                        token_uri: "https://oauth2.googleapis.com/token",
                    };
                    if (!(0, app_1.getApps)().length) {
                        (0, app_1.initializeApp)({
                            credential: (0, app_1.cert)(serviceAccount),
                        });
                    }
                    db = (0, firestore_1.getFirestore)();
                    settingsDoc = db.collection("settings").doc("financeSettings");
                    financeSettings = {
                        enabled: true,
                        upi: {
                            enabled: true,
                            id: "9886364462@ptsbi", // User's UPI ID
                            displayName: "Sri Raghavendra Swamy Matha",
                        },
                        bankTransfer: {
                            enabled: false,
                            accountName: "",
                            accountNumber: "",
                            bankName: "",
                            ifscCode: "",
                            branch: "",
                        },
                        specialSevas: [
                            {
                                id: "1",
                                title: "Annadanam",
                                description: "Sponsor prasada and meals for devotees visiting the temple.",
                                amount: 501,
                                icon: "heart",
                                isActive: true,
                                order: 1,
                            },
                            {
                                id: "2",
                                title: "Goshala",
                                description: "Support the care and maintenance of our sacred cows.",
                                amount: 1001,
                                icon: "cows",
                                isActive: true,
                                order: 2,
                            },
                            {
                                id: "3",
                                title: "Temple Development",
                                description: "Contribute towards renovation and future development projects.",
                                amount: 5001,
                                icon: "building",
                                isActive: true,
                                order: 3,
                            },
                        ],
                        updatedAt: new Date().toISOString(),
                    };
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, settingsDoc.set(financeSettings)];
                case 2:
                    _a.sent();
                    console.log("✅ Finance settings updated successfully!");
                    console.log("UPI ID: 9886364462@ptsbi");
                    console.log("UPI Display Name: Sri Raghavendra Swamy Matha");
                    console.log("UPI Enabled: true");
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error("Error updating finance settings:", error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
updateFinanceSettings().catch(console.error);
