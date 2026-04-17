# Deployment Guide for Todo App

This guide walks you through the process of deploying your application to a Kubernetes cluster using the configuration files in `infra/k8s`.

## Prerequisites
1. **Docker** installed and running on your machine.
2. **Kubernetes Cluster** running locally (e.g., Docker Desktop Kubernetes, Minikube, or kind).
3. **kubectl** CLI installed.

## 1. Build the Docker Images
You have Dockerfiles for both your frontend and backend. You need to build both images so Kubernetes can use them.
From the root directory of the project, run:

```bash
# Build Backend Image
docker build -t yourdockerhub/todo-backend:latest ./backend

# Build Frontend Image
docker build -t yourdockerhub/todo-frontend:latest ./frontend
```
*Note: If you are using a local cluster like Docker Desktop, Kubernetes can pull these images directly from your local Docker cache. If using Minikube or a cloud provider, you'll need to push these images to Docker Hub (`docker push yourdockerhub/...`).*

## 2. Configure Environment Variables
Currently, your `infra/k8s/backend-deployment.yaml` uses placeholder values for critical secrets. 

**IMPORTANT**: Before deploying, you must edit `infra/k8s/backend-deployment.yaml` and replace the placeholder placeholders (like `YOUR_SUPABASE_URL`, `YOUR_SUPABASE_JWT_SECRET`, etc.) with your actual credentials from your `backend/.env` file. 

*(For a production environment, you should migrate these values to a Kubernetes `Secret` rather than keeping them in the deployment file).*

## 3. Apply Kubernetes YAML Files
You can tell Kubernetes to spin up your application based on the files in `infra/k8s`.

```bash
# 1. Create the namespace first
kubectl apply -f infra/k8s/namespace.yaml

# 2. Deploy Redis
kubectl apply -f infra/k8s/redis-deployment.yaml
kubectl apply -f infra/k8s/redis-service.yaml

# 3. Deploy the Backend
kubectl apply -f infra/k8s/backend-deployment.yaml
kubectl apply -f infra/k8s/backend-service.yaml

# 4. Deploy the Frontend
kubectl apply -f infra/k8s/frontend-deployment.yaml
kubectl apply -f infra/k8s/frontend-service.yaml

# 5. (Optional) Apply Horizontal Pod Autoscalers (requires Metrics Server)
kubectl apply -f infra/k8s/frontend-hpa.yaml
kubectl apply -f infra/k8s/backend-hpa.yaml
```

*Alternatively, you can apply everything at once using `kubectl apply -f infra/k8s/` if the namespace is created first.*

## 4. Verify the Deployment
Check if all the pods are running without errors:
```bash
kubectl get pods -n todo-app
```

Check the services to see how you can access the frontend:
```bash
kubectl get services -n todo-app
```

## 5. Access the App
If you are running on Docker Desktop, access the frontend via the `frontend-service` (usually exposed on localhost depending on if it's set as a `LoadBalancer` or `NodePort`).

To forward the frontend port directly to your browser for testing:
```bash
kubectl port-forward service/frontend-service 8080:80 -n todo-app
```
Then open your browser to `http://localhost:8080`.
