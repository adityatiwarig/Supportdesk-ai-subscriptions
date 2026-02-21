import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

function CheckAuth({ children, protected: isProtected }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (isProtected && !token) {
      navigate("/login", { replace: true });
      return;
    }

    if (!isProtected && token) {
      navigate("/", { replace: true });
    }
  }, [navigate, isProtected, token]);

  return children;
}

export default CheckAuth;
