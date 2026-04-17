# Easy Cloud Deployment (Vercel & Render)

If you don't want to manage Kubernetes or Docker directly, the easiest way to deploy a separated frontend/backend application is using managed cloud platforms. 

Since you are already using **Supabase** for your database and auth, you only need to host:
1. **The Frontend (React/Vite)** 
2. **The Backend (Node/Express)**
3. **Redis**

---

## 1. Frontend ➜ Vercel (Free & Fastest)

Vercel is optimized for frontend React applications.

1. Push your code to a GitHub repository.
2. Go to [Vercel.com](https://vercel.com) and click **Add New Project**.
3. Select your GitHub repository.
4. **Framework Preset**: Vercel will automatically detect `Vite`. Let the build command be `npm run build`.
5. **Root Directory**: Click "Edit" and set the root directory to `frontend`.
6. **Environment Variables**: Add your variables from your `frontend/.env` file:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (Set this to your backend URL once it's deployed, e.g., `https://todo-backend.onrender.com/api`)
7. Click **Deploy**.

---

## 2. Backend & Redis ➜ Render or Railway
Because your backend uses Express.js (which requires a continuously running server) and Redis, a platform like **Render.com** or **Railway.app** is ideal.

### Option A: Using Render.com (Recommended)
Render natively supports Node.js web services and managed Redis.

1. Go to [Render.com](https://render.com) and create an account.
2. **Create Redis**:
   - Click "New" > "Redis"
   - Name it `todo-redis` and select the Free tier.
   - Copy the "Internal Redis URL".
3. **Create Backend Web Service**:
   - Click "New" > "Web Service"
   - Connect your GitHub repository.
   - **Root Directory**: Set this to `backend`.
   - **Environment**: Select `Node`.
   - **Build Command**: `npm install`
   - **Start Command**: `npm start` (or `node src/index.js`)
4. **Add Environment Variables**:
   Under the "Environment" tab, paste all variables from `backend/.env`, including:
   - `REDIS_URL`: Paste the Internal Redis URL from step 2.
   - `FRONTEND_URL`: Paste the URL Vercel gave you in step 1 (e.g., `https://my-todo-app.vercel.app`). This is critical so CORS allows your frontend to talk to your backend.
   - All your Supabase and Razorpay keys.
5. Click **Create Web Service**. 

Once Render is finished deploying, it will give you a backend URL (like `https://your-todo-backend.onrender.com`). Go back to **Vercel** and update `VITE_API_URL` to this backend URL and redeploy the frontend!

---

## 3. Database & Auth ➜ Supabase
Your Supabase instance is already hosted in the cloud. Just ensure that you go into your Supabase Dashboard -> **Authentication** -> **URL Configuration**, and add your final **Vercel domain** to the "Site URL" and "Redirect URLs" so logins don't get blocked.
