import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMeeting } from "../../services/Firebaseapi";
import { createMeeting } from "../../services/Firebaseapi";

export default function Home() {
    const [code, setCode] = useState("");
    const navigate = useNavigate();

    const handleCreateMeeting = async () => {

        try {
            const res = await createMeeting({
                title: "Nueva reunión",
            });

            const meetingId = res.meeting.id;

            navigate(`/meet/${meetingId}`);

        } catch (err) {
            console.error("Error al crear reunión:", err);
            alert("No se pudo crear la reunión.");
        }
    };
    return (
        <div className="flex flex-col min-h-screen bg-[#eef1ff]">

            {/* HERO SECTION */}
            <section className="flex flex-col items-center text-center mt-12 px-4">

                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 drop-shadow">
                    Videoconferencias seguras para todos
                </h1>

                {/* INPUT DE CÓDIGO + BOTÓN UNIRSE */}
                <div className="flex flex-col md:flex-row items-center gap-4 mt-6">
                    <div className="flex items-center bg-white border border-gray-300 px-4 py-3 rounded-xl shadow">

                        <Calendar className="text-[#345CFF]" size={20} />

                        <input
                            className="ml-2 focus:outline-none bg-transparent"
                            placeholder="Introducir código"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />

                        <button
                            onClick={async () => {
                                if (!code.trim()) {
                                    alert("Ingresa un código de reunión");
                                    return;
                                }

                                try {
                                    const res = await getMeeting(code);

                                    if (!res) {
                                        alert("El código no existe. Verifica e inténtalo de nuevo.");
                                        return;
                                    }

                                    window.location.href = `/meet/${code}`;
                                } catch (err) {
                                    console.error("Error verificando reunión:", err);
                                    alert("No se pudo verificar el código con el servidor.");
                                }
                            }}
                            className="ml-3 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition cursor-pointer"
                        >
                            Unirse
                        </button>
                    </div>
                </div>

                {/* IMAGEN + BOTÓN CREAR REUNIÓN */}
                <div className="mt-14 w-full max-w-4xl relative rounded-3xl overflow-hidden shadow-xl">
                    <img
                        src="https://images.unsplash.com/photo-1590650046871-92c887180603?auto=format&fit=crop&w=1400&q=80"
                        alt="Video conference"
                        className="w-full h-80 object-cover brightness-75"
                    />

                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-4">
                        <h2 className="text-4xl font-bold drop-shadow">
                            Conecta. Comparte. Colabora.
                        </h2>

                        <p className="mt-3 max-w-xl text-lg drop-shadow">
                            La nueva forma inteligente de comunicarte con tu equipo y amigos.
                        </p>

                        {/* Botón Crear Reunión */}

                        <button
                            onClick={handleCreateMeeting}
                            className="mt-6 bg-blue-600 px-6 py-3 rounded-xl shadow hover:bg-blue-700 transition cursor-pointer">
                            Crear reunión
                        </button>

                    </div>
                </div>

            </section>
        </div>
    );
}
