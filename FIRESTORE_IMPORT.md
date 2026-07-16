# Firestore Import Guide

## Option 1: Manual Import via Firebase Console (Recommended)

### 1. Export Events
```bash
npm run export:aaradhane -- --year 2026
npm run export:aaradhane -- --year 2027
```

This creates JSON files in `data/exports/`

### 2. Convert to Firestore Format

The exported JSON needs to be in Firestore document format:

```bash
# The JSON is already in Firestore format!
cat data/exports/aaradhane-events-2026.json
```

### 3. Import via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **sri-raghavendra-mutt**
3. Go to **Firestore Database** > **Import JSON**
4. Upload the JSON file from `data/exports/aaradhane-events-2026.json`

### 4. Collection Name

Import to collection: **`aaradhanes`** (plural, as per firestore.rules)

---

## Option 2: Firebase CLI Import

### 1. Install Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Login
```bash
firebase login
```

### 3. Import
```bash
firebase firestore:import data/exports/aaradhane-events-2026.json --project sri-raghavendra-mutt
```

---

## Option 3: Service Account (Full Automation)

### 1. Get Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Project: **sri-raghavendra-mutt**
3. ⚙️ Settings > **Service accounts**
4. Click **"Generate new private key"**
5. Save as `firebase-admin.json` in project root

### 2. Update Scripts

The scripts will automatically use the Admin SDK after this.

---

## Event Data Summary

### 2026 Events (19 total)
| Guru | Date | Importance |
|------|------|------------|
| Sri Madhvacharya | Mar 28-30 | Major |
| Sri Padmanabha Teertha | Apr 24 | Minor |
| Sri Narahari Teertha | Jun 10 | Minor |
| Sri Madhava Teertha | Jul 18 | Minor |
| Sri Vibudhendra Teertha | Mar 16 | Minor |
| Sri Jitamitra Teertha | Apr 12 | Minor |
| Sri Raghunandana Teertha | Apr 27 | Minor |
| Sri Ramachandra Teertha | Jan 25 | Minor |
| Sri Akshobhya Teertha | Oct 3 | Minor |
| Sri Kavendra Teertha | Dec 4 | Minor |
| Sri Vageesha Teertha | Dec 12 | Minor |
| Sri Surendra Teertha | May 25 | Minor |
| Sri Jayateertha | Sep 20-21 | Major |
| Sri Vidyadhiraja Tirtha | Oct 26-28 | Major |
| Sri Vijayeendra Teertha | Sep 11-13 | Major |
| Sri Sudheeendra Teertha | Sep 18-19 | Major |
| Sri Raghavendra Poorva | May 15-17 | Major |
| Sri Raghavendra Madhya | May 26-28 | Major |
| Sri Raghavendra Uttara | Feb 13-15 | Major |

### 2027 Events (19 total)
| Guru | Date | Importance |
|------|------|------------|
| Sri Madhvacharya | Apr 16-18 | Major |
| Sri Raghavendra Uttara | Mar 3-5 | Major |
| Sri Raghavendra Poorva | Jun 3-5 | Major |
| Sri Raghavendra Madhya | Jun 14-16 | Major |
| Sri Vijayeendra Teertha | Aug 31 - Sep 2 | Major |
| Sri Jayateertha | Sep 9-10 | Major |
| Sri Sudheeendra Teertha | Sep 7-8 | Major |
| Sri Vidyadhiraja Tirtha | Oct 15-17 | Major |
| + 11 minor events | Various | Minor |
