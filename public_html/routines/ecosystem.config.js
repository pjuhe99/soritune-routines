module.exports = {
  apps: [
    {
      name: "routines",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      cwd: "/var/www/html/_______site_SORITUNECOM_ROUTINES/public_html/routines",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
