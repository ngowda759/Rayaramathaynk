"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var poojas = [
    // Daily Sevas - sorted by amount ASC
    { title: "Arati", description: "Arati", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 20, isActive: true, displayOrder: 1, days: ["All"], notes: "" },
    { title: "Panchamrutha", description: "Panchamrutha", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 100, isActive: true, displayOrder: 2, days: ["All"], notes: "" },
    { title: "Madhu Abhisheka", description: "Madhu Abhisheka", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 200, isActive: true, displayOrder: 3, days: ["All"], notes: "" },
    { title: "Vahana Pooja", description: "Vahana Pooja", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 200, isActive: true, displayOrder: 4, days: ["All"], notes: "" },
    { title: "Hastodaka", description: "Hastodaka", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 250, isActive: true, displayOrder: 5, days: ["All"], notes: "" },
    { title: "Totillu Seva", description: "Totillu Seva", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 250, isActive: true, displayOrder: 6, days: ["All"], notes: "" },
    { title: "Padapooja", description: "Padapooja", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 500, isActive: true, displayOrder: 7, days: ["All"], notes: "" },
    { title: "Annadana Seve", description: "Annadana Seve", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 500, isActive: true, displayOrder: 8, days: ["All"], notes: "" },
    { title: "Anna Santharpana Seva", description: "Anna Santharpana Seva", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 2500, isActive: true, displayOrder: 9, days: ["All"], notes: "" },
    { title: "Archane with Arati", description: "Archane with Arati", startTime: "07:00", duration: "30 mins", category: "Daily", sevaAmount: 50, isActive: true, displayOrder: 10, days: ["All"], notes: "" },
    // Special Sevas - sorted by amount ASC
    { title: "Rathotsava", description: "Rathotsava", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 11, days: ["All"], notes: "" },
    { title: "Annaprashana / Aksharaabhysa", description: "Annaprashana / Aksharaabhysa", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 12, days: ["All"], notes: "" },
    { title: "Maha Pooja", description: "Maha Pooja", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 13, days: ["All"], notes: "" },
    { title: "Sankalpa Shraddha", description: "Sankalpa Shraddha", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 14, days: ["All"], notes: "" },
    { title: "Taila Nandadeepa", description: "Taila Nandadeepa", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1000, isActive: true, displayOrder: 15, days: ["All"], notes: "" },
    { title: "Kanakabhisheka", description: "Kanakabhisheka", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1001, isActive: true, displayOrder: 16, days: ["All"], notes: "" },
    { title: "Satyanarayana Pooja", description: "Satyanarayana Pooja", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1200, isActive: true, displayOrder: 17, days: ["All"], notes: "" },
    { title: "Chataka Shraddha", description: "Chataka Shraddha", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 1500, isActive: true, displayOrder: 18, days: ["All"], notes: "" },
    { title: "Rajatakavacha Samarpana", description: "Rajatakavacha Samarpana", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 2500, isActive: true, displayOrder: 19, days: ["All"], notes: "" },
    { title: "Prasada Seva", description: "Prasada Seva", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 2500, isActive: true, displayOrder: 20, days: ["All"], notes: "" },
    { title: "Grutha Nandadeepa", description: "Grutha Nandadeepa", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 2500, isActive: true, displayOrder: 21, days: ["All"], notes: "" },
    { title: "Anantapadmanabha Vruta", description: "Anantapadmanabha Vruta", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 4000, isActive: true, displayOrder: 22, days: ["All"], notes: "" },
    { title: "Pratyaksha Govu Daana", description: "Pratyaksha Govu Daana", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 5000, isActive: true, displayOrder: 23, days: ["All"], notes: "" },
    { title: "Reshme Vastra Seva", description: "Reshme Vastra Seva", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 5000, isActive: true, displayOrder: 24, days: ["All"], notes: "" },
    { title: "Srinivasa Kalyana", description: "Srinivasa Kalyana", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 7000, isActive: true, displayOrder: 25, days: ["All"], notes: "" },
    { title: "Shaswatha Annadana Seva", description: "Shaswatha Annadana Seva", startTime: "09:00", duration: "60 mins", category: "Special", sevaAmount: 10000, isActive: true, displayOrder: 26, days: ["All"], notes: "" },
];
function seedPoojas() {
    return __awaiter(this, void 0, void 0, function () {
        var privateKey, serviceAccount, db, poojasCollection, existingPoojas, deletePromises, _i, poojas_1, pooja;
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
                    poojasCollection = db.collection("dailyPoojas");
                    // Delete existing poojas
                    console.log("Deleting existing poojas...");
                    return [4 /*yield*/, poojasCollection.get()];
                case 1:
                    existingPoojas = _a.sent();
                    deletePromises = existingPoojas.docs.map(function (d) { return d.ref.delete(); });
                    return [4 /*yield*/, Promise.all(deletePromises)];
                case 2:
                    _a.sent();
                    console.log("Deleted ".concat(existingPoojas.size, " existing poojas"));
                    // Add new poojas in sorted order
                    console.log("\nAdding poojas sorted by amount (ASC)...");
                    _i = 0, poojas_1 = poojas;
                    _a.label = 3;
                case 3:
                    if (!(_i < poojas_1.length)) return [3 /*break*/, 6];
                    pooja = poojas_1[_i];
                    return [4 /*yield*/, poojasCollection.add(__assign(__assign({}, pooja), { createdAt: new Date().toISOString(), createdBy: "system" }))];
                case 4:
                    _a.sent();
                    console.log("Added: ".concat(pooja.title, " - INR ").concat(pooja.sevaAmount));
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    console.log("\nSuccessfully added ".concat(poojas.length, " poojas sorted by amount!"));
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
seedPoojas().catch(function (error) {
    console.error("Error seeding poojas:", error);
    process.exit(1);
});
