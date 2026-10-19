import { execSync } from 'child_process';
try {
  execSync('TENANT_URL=https://localhost CLIENT_ID=test CLIENT_SECRET=test node -e "import(\\\"./scripts/restore.mjs\\\")"', {stdio: 'inherit'});
  console.log("Success");
} catch(e) {
  console.log("Failed", e.message);
}
