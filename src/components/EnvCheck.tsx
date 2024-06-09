import { useEffect, useState } from "react";

const EnvCheck = () => {
  const [env, setEnv] = useState<{
    NEXT_PUBLIC_SERVER_URL: string | null;
  } | null>(null);

  useEffect(() => {
    fetch("/api/env-check")
      .then((response) => response.json())
      .then((data) => setEnv(data))
      .catch((error) => console.error("Error fetching env variables:", error));
  }, []);

  return (
    <div>
      <h1>Environment Variables</h1>
      {env ? (
        <pre>{JSON.stringify(env, null, 2)}</pre>
      ) : (
        <p>Loading environment variables...</p>
      )}
    </div>
  );
};

export default EnvCheck;
