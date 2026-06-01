module.exports = {
  apps: [
    {
      name: "cmd-images-market",
      script: "dist/main.js",
      cwd: "/var/www/cmd-images-market",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
