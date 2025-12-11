import React, { useState } from "react";
import { useNavigate } from 'react-router-dom';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from "../../lib/firebase.config";
import { setAuthToken } from "../../services/authToken";

const Login: React.FC = () => {
    const navigate = useNavigate();
    /** Array of validation or server errors */
    const [errores, setErrores] = useState<string[]>([]);

    const handleLoginGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);

            const user = result.user;

            const idToken = await user.getIdToken(true);
            setAuthToken(idToken);

            localStorage.setItem("email", user.email || "");
            localStorage.setItem("userName", user.displayName || "");

            navigate("/profile");
        } catch (error) {
            console.error(error);
            setErrores(["Ocurrió un error al iniciar sesión con Google"]);
        }
    };

    return (
        <div className="container-page">
            <div >
                <h1>Iniciar Sesión</h1>
                <div>
                    <button onClick={handleLoginGoogle} >
                        <img src="icons/google-icon.svg" alt="Iniciar sesión con Google" width={24} height={24} />
                        <span>Google</span>
                    </button>
                </div>
            </div>
            {errores.length > 0 && (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-3 space-y-1">
                    {errores.map((err, idx) => (
                        <p key={idx} className="text-red-400 text-xs flex items-start">
                            <span className="mr-2">•</span> {err}
                        </p>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Login