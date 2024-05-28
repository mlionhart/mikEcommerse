/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["econ-site-data.s3.us-east-2.amazonaws.com"], // Add your S3 bucket domain here
  },
};

export default nextConfig;
