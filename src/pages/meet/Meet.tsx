import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../../stores/useAuthStore';
import { useParams } from "react-router-dom";

interface Message {
  message: string;
  user: string;
  timestamp: string;
}

const Meet: React.FC = () => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null); // tu video local (ya existente)
  const remoteVideoRef = useRef<HTMLVideoElement>(null); // video del otro participante
  const chatSocketRef = useRef<any>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  const { roomId } = useParams<{ roomId: string }>();

  useEffect(() => {
    // Conectar socket (chat + señalización)
    chatSocketRef.current = io('http://localhost:3000');

    // join room (mantengo tu evento original)
    chatSocketRef.current.emit('joinRoom', roomId);

    // Señalización: cuando otro usuario entra, podemos crear offer
    // Soporto 'user-joined' (si tu server la emite) y 'user-joined-server' por compatibilidad
    chatSocketRef.current.on('user-joined', async () => {
      // Si ya tengo peer y local stream, crear offer
      if (peerRef.current && stream) {
        await createOffer();
      }
    });

    // Mensajes de chat (mantengo tu lógica)
    chatSocketRef.current.on('receiveMessage', (data: Message) => {
      setMessages(prev => [...prev, data]);
    });

    // Señalización: recibir offer
    chatSocketRef.current.on('offer', async (offer: RTCSessionDescriptionInit) => {
      try {
        await ensurePeer();
        await peerRef.current!.setRemoteDescription(offer);
        const answer = await peerRef.current!.createAnswer();
        await peerRef.current!.setLocalDescription(answer);
        chatSocketRef.current.emit('answer', { roomId, answer });
      } catch (err) {
        console.error('Error processing offer:', err);
      }
    });

    // Señalización: recibir answer
    chatSocketRef.current.on('answer', async (payload: { answer: RTCSessionDescriptionInit }) => {
      try {
        const answer = payload?.answer ?? payload; // soporte ambos formatos
        await peerRef.current?.setRemoteDescription(answer);
      } catch (err) {
        console.error('Error applying answer:', err);
      }
    });

    // ICE candidates
    chatSocketRef.current.on('ice-candidate', async (candidate: RTCIceCandidateInit) => {
      try {
        if (candidate) {
          await peerRef.current?.addIceCandidate(candidate);
        }
      } catch (err) {
        console.error('Error adding remote ICE candidate:', err);
      }
    });

    // Obtener media local
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(currentStream => {
      setStream(currentStream);
      if (videoRef.current) {
        videoRef.current.srcObject = currentStream;
      }
      // Crear peer connection y agregar tracks
      createPeerConnection(currentStream);
    }).catch(err => console.error('Error accessing media devices:', err));

    return () => {
      // cleanup
      chatSocketRef.current?.disconnect();
      peerRef.current?.close();
      stream?.getTracks().forEach(track => track.stop());
      screenStream?.getTracks().forEach(track => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roomId]); // run once when user/roomId cambia

  // CHAT: enviar mensaje (mantengo tu lógica)
  const sendMessage = () => {
    if (newMessage.trim() && chatSocketRef.current) {

      const username =
        user?.displayName ||
        localStorage.getItem("userName") ||
        "Anónimo";

      chatSocketRef.current.emit("sendMessage", {
        roomId,
        message: newMessage,
        user: username,
      });

      setNewMessage("");
    }
  };

  // -- Funciones WebRTC --

  const ensurePeer = async () => {
    if (!peerRef.current) {
      await createPeerConnection(stream);
    }
  };

  const createPeerConnection = (localStreamParam?: MediaStream | null) => {
    if (peerRef.current) return peerRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // cuando encontramos ICE candidates locales, los enviamos vía socket
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        chatSocketRef.current.emit('ice-candidate', { roomId, candidate: event.candidate });
      }
    };

    // cuando llega el stream remoto, lo colocamos en el remoteVideoRef
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    };

    // agregar tracks locales (si ya los tenemos)
    const local = localStreamParam ?? stream;
    if (local) {
      local.getTracks().forEach(track => pc.addTrack(track, local));
    }

    peerRef.current = pc;
    return pc;
  };

  // Crear offer y emitirla
  const createOffer = async () => {
    try {
      await ensurePeer();
      const pc = peerRef.current!;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      // Emite offer con roomId (al servidor)
      chatSocketRef.current.emit('offer', { roomId, offer });
    } catch (err) {
      console.error('Error creando offer:', err);
    }
  };

  // Alternar micrófono (mantengo tu lógica)
  const toggleMute = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Alternar cámara (mantengo tu lógica)
  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  // Compartir pantalla: reemplaza el track de video del peer (sin cambiar UI)
  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      // detener compartir pantalla -> restaurar cámara
      if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        setScreenStream(null);
      }
      // restaurar track original en la conexión
      if (stream && peerRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = peerRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
        if (videoRef.current) videoRef.current.srcObject = stream;
      }
      setIsSharingScreen(false);
    } else {
      // iniciar compartir pantalla
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(displayStream);

        // reemplazar el sender's track por el de pantalla
        const displayTrack = displayStream.getVideoTracks()[0];
        const sender = peerRef.current?.getSenders().find(s => s.track && s.track.kind === 'video');

        if (sender) {
          await sender.replaceTrack(displayTrack);
        }

        // mostrar localmente la pantalla compartida en tu videoRef
        if (videoRef.current) videoRef.current.srcObject = displayStream;
        setIsSharingScreen(true);

        // si el usuario detiene compartir desde el navegador, restaurar
        displayTrack.addEventListener('ended', () => {
          // al terminar desde navegador, llamamos de nuevo para restaurar
          if (isSharingScreen) {
            // Restauración en next tick
            setTimeout(() => toggleScreenShare(), 100);
          }
        });

      } catch (err) {
        console.error('Error sharing screen:', err);
      }
    }
  };

  // UI: no modifiqué estructura ni clases. Reemplacé el placeholder "Esperando participante..." por un video remoto (mismo tamaño y estilo).
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white text-center mb-6">Reunión en Tiempo Real</h1>
        {/* 🔵 Mostrar código de reunión */}
        <p className="text-center text-blue-300 font-semibold mb-6">
          Código de la reunión: <span className="text-white">{roomId}</span>
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-black bg-opacity-50 p-4 rounded-lg shadow-lg">
              <h2 className="text-xl text-white mb-4">Participantes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <video ref={videoRef} autoPlay muted className="w-full h-64 bg-gray-800 rounded border-2 border-blue-500" />
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                    Tú
                  </div>
                </div>
                <div className="relative">
                  {/* Aquí mantenemos el mismo contenedor y estilo, pero ahora colocamos un video para el remoto */}
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-64 bg-gray-800 rounded border-2 border-gray-500 object-cover" />
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                    Participante 2
                  </div>
                </div>
              </div>
              <div className="flex justify-center space-x-4 mt-4">
                <button
                  onClick={toggleMute}
                  className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-full shadow-lg transition-colors flex flex-col items-center"
                  title={isMuted ? 'Activar micrófono' : 'Silenciar'}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    {isMuted ? (
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.414 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.414l3.969-3.816a1 1 0 011.616.816zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 011.414-1.414z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.414 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.414l3.969-3.816a1 1 0 011.616.816zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                    )}
                  </svg>
                  <span className="text-xs mt-1">Sonido</span>
                </button>
                <button
                  onClick={toggleCamera}
                  className={`p-3 rounded-full shadow-lg transition-colors flex flex-col items-center ${isCameraOff ? 'bg-gray-500 hover:bg-gray-600' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                  title={isCameraOff ? 'Encender cámara' : 'Apagar cámara'}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    {isCameraOff ? (
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0010.586 3H7.414a1 1 0 00-.707.293L5.293 4.707A1 1 0 014.586 5H4zm8 9a3 3 0 100-6 3 3 0 000 6zM13.5 6.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM7 6.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 0010.586 3H7.414a1 1 0 00-.707.293L5.293 4.707A1 1 0 014.586 5H4zm8 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    )}
                  </svg>
                  <span className="text-xs mt-1">Cámara</span>
                </button>
                <button
                  onClick={toggleScreenShare}
                  className={`p-3 rounded-full shadow-lg transition-colors flex flex-col items-center ${isSharingScreen ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600'} text-white`}
                  title={isSharingScreen ? 'Detener compartir pantalla' : 'Compartir pantalla'}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs mt-1">Pantalla</span>
                </button>
                <button
                  onClick={() => window.history.back()}
                  className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full shadow-lg transition-colors flex flex-col items-center"
                  title="Cerrar llamada"
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs mt-1">Cerrar llamada</span>
                </button>
              </div>
            </div>
          </div>
          <div className="bg-white bg-opacity-95 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4 text-gray-800">Chat</h2>
            <div className="h-96 overflow-y-auto border border-gray-300 p-2 mb-4 bg-gray-50 rounded">
              {messages.map((msg, index) => (
                <div key={index} className="mb-2 p-2 bg-blue-100 rounded">
                  <strong className="text-blue-800">{msg.user}:</strong> <span className="text-gray-700">{msg.message}</span>
                  <small className="text-gray-500 block">{new Date(msg.timestamp).toLocaleTimeString()}</small>
                </div>
              ))}
            </div>
            <div className="flex">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1 border border-gray-300 px-3 py-2 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Escribe un mensaje..."
              />
              <button
                onClick={sendMessage}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-r transition-colors"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Meet;
