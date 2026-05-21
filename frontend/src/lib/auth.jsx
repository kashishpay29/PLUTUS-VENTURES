import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = unauth
  const [token, setToken] = useState(localStorage.getItem("token"));

  useEffect(() => {
  let ok = true;

  (async () => {
    if (!token) {
      setUser(false);
      return;
    }

    try {
      const { data } = await api.get("/auth/me");
      if (ok) {
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      }
    } catch (err) {
      // Only clear session on explicit 401, not network errors
      if (err?.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        if (ok) { setUser(false); setToken(null); }
      } else {
        // Network/server error — use cached user so page still loads
        const storedUser = localStorage.getItem("user");
        if (storedUser && ok) {
          setUser(JSON.parse(storedUser));
        } else {
          if (ok) { setUser(false); setToken(null); }
        }
      }
    }
  })();

  return () => { ok = false; };
}, [token]);

  const login = (newToken, userData) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(false);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);