# API Documentation

Base URL: `https://rayaramathaynk.vercel.app/api`

---

## Admin User Management

### 1. Create Super Admin
Creates a new super admin user with Firebase Authentication and Firestore.

**Endpoint:** `POST /api/admin/users/create-admin`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "securePassword123",
  "name": "Admin Name"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Super Admin created: administrator@rayaramathaynk.com"
}
```

**Response (Error - 400):**
```json
{
  "error": "Email, password, and name are required"
}
```

**Response (Error - 500):**
```json
{
  "error": "Failed to create admin"
}
```

---

### 2. Set User Role
Updates the role of an existing user in Firestore.

**Endpoint:** `POST /api/admin/users/set-role`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "role": "super_admin"
}
```

**Available Roles:**
- `super_admin` - Full system access
- `admin` - Admin access
- `priest` - Priest access
- `user` - Regular user (default)

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "User user@example.com has been set as super_admin",
  "userId": "firebase-uid-123"
}
```

**Response (Error - 404):**
```json
{
  "error": "User not found. Please ensure the user has logged in at least once."
}
```

**Response (Error - 400):**
```json
{
  "error": "Email and role are required"
}
```

---

## Gallery

### 3. Get Local Gallery Assets
Retrieves all images and videos from local `public/images/temple` and `public/videos` directories.

**Endpoint:** `GET /api/gallery/local-assets`

**Response (Success - 200):**
```json
{
  "localImages": [
    {
      "id": "img-temple1.jpg",
      "src": "/images/temple/temple1.jpg",
      "title": "Temple Exterior",
      "alt": "Temple Exterior"
    }
  ],
  "localVideos": [
    {
      "id": "vid-ceremony.mp4",
      "src": "/videos/ceremony.mp4",
      "title": "Morning Ceremony",
      "alt": "Morning Ceremony"
    }
  ]
}
```

---

### 4. Delete Local Gallery Asset
Deletes a file from the local filesystem.

**Endpoint:** `DELETE /api/gallery/local-assets`

**Request Body:**
```json
{
  "src": "/images/temple/temple1.jpg"
}
```

**Response (Success - 200):**
```json
{
  "success": true
}
```

**Response (Error - 403):**
```json
{
  "error": "Unauthorized path"
}
```

**Response (Error - 404):**
```json
{
  "error": "File not found"
}
```

---

## Usage Examples

### Create Admin with cURL
```bash
curl -X POST https://rayaramathaynk.vercel.app/api/admin/users/create-admin \
  -H "Content-Type: application/json" \
  -d '{"email":"newadmin@rayaramathaynk.com","password":"securePassword123","name":"New Admin"}'
```

### Set User Role with cURL
```bash
curl -X POST https://rayaramathaynk.vercel.app/api/admin/users/set-role \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","role":"admin"}'
```

### Get Gallery Assets with cURL
```bash
curl https://rayaramathaynk.vercel.app/api/gallery/local-assets
```

### Delete Gallery Asset with cURL
```bash
curl -X DELETE https://rayaramathaynk.vercel.app/api/gallery/local-assets \
  -H "Content-Type: application/json" \
  -d '{"src":"/images/temple/temple1.jpg"}'
```

---

## Notes

- All admin endpoints require appropriate authentication/authorization on the client side
- User must have logged in at least once before their role can be set
- Gallery delete is restricted to `/images/temple/` and `/videos/` directories only
- File names are normalized (hyphens/underscores replaced with spaces) for display titles
