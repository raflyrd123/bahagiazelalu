'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { ChevronRight, ChevronLeft, Music, MicOff, QrCode, Heart, Camera, RefreshCw, Download } from 'lucide-react'
import confetti from 'canvas-confetti'

export default function AzelBahagia() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [lives, setLives] = useState(3)
  const [isGameOver, setIsGameOver] = useState(false)
  const [quizFeedback, setQuizFeedback] = useState('')
  
  // State Photobooth
  const [photos, setPhotos] = useState([])
  const [isCounting, setIsCounting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [finalStrip, setFinalStrip] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isFlashing, setIsFlashing] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSong, setCurrentSong] = useState('/tanda.mp3')

  const [formData, setFormData] = useState({
    nama: '', tempat_lahir: '', tanggal_lahir: '', alamat: '', ukuran_sepatu: '',
    kesan_pertama: '', pertanyaan_lebaran: '', pertanyaan_lanjut: '', pesan_untuk_rafly: '',
    q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '', q8: [], q9: []
  })

  // LOGIKA LAGU
  useEffect(() => {
    if (step >= 6) setCurrentSong('/terbuang.mp3')
    else setCurrentSong('/tanda.mp3')
  }, [step])

  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      audioRef.current.load()
      audioRef.current.play().catch(e => console.log("Blocked"))
    }
  }, [currentSong])

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause()
      else audioRef.current.play().catch(e => console.log("Blocked"))
      setIsPlaying(!isPlaying)
    }
  }

  const nextStep = () => { setQuizFeedback(''); setStep(step + 1); }
  const prevStep = () => setStep(step - 1)
  const isFormValid = formData.nama.trim() !== '' && formData.tempat_lahir.trim() !== '' && formData.tanggal_lahir !== '' && formData.alamat.trim() !== '' && formData.ukuran_sepatu !== '';

  // --- LOGIKA PHOTOBOOTH ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { console.log("Kamera error"); }
  }

  const startPhotobooth = () => {
    setPhotos([]);
    setFinalStrip(null);
    let capturedSoFar = [];
    takeSequence(0, capturedSoFar);
  }

  const takeSequence = (index, capturedSoFar) => {
    if (index >= 3) {
      setIsCounting(false);
      return generateStrip(capturedSoFar);
    }
    let count = 3;
    setIsCounting(true);
    setCountdown(count);
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(timer);
        setCountdown(""); 
        setIsFlashing(true); 
        const newPhoto = captureSingle();
        setTimeout(() => {
          setIsFlashing(false);
          const updatedList = [...capturedSoFar, newPhoto];
          setPhotos(updatedList);
          setTimeout(() => takeSequence(index + 1, updatedList), 2000);
        }, 400); 
      }
    }, 1000);
  }

  const captureSingle = () => {
    const video = videoRef.current;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = video.videoWidth;
    offCanvas.height = video.videoHeight;
    const ctx = offCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return offCanvas.toDataURL('image/jpeg', 0.9);
  }

  const generateStrip = async (allPhotos) => {
    setIsGenerating(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = 1600;
    const h = 3600;
    canvas.width = w;
    canvas.height = h;

    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = src;
      });
    };
    try {
      const template = await loadImage('/strip-template.png');
      ctx.drawImage(template, 0, 0, w, h);
      const imageObjects = await Promise.all(allPhotos.map(p => loadImage(p)));
      
      imageObjects.forEach((img, i) => {
        const imgW = 1400; 
        const imgH = 850; 
        const x = 100;      
        const y = 100 + (i * 880); 
        ctx.drawImage(img, x, y, imgW, imgH);
      });

      setFinalStrip(canvas.toDataURL('image/jpeg', 0.9)); 
      const stream = videoRef.current?.srcObject;
      if(stream) stream.getTracks().forEach(t => t.stop());
    } catch (e) {
      console.log("Template error");
    } finally {
      setIsGenerating(false);
    }
  }

  const downloadImage = () => {
    if (!finalStrip) return;
    const link = document.createElement('a');
    link.href = finalStrip;
    link.download = `Eid-Photobooth-Azel.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- DATABASE ACTIONS ---
  const handleSubmitInitial = async () => {
    setLoading(true);
    await supabase.from('responden_thr').insert([{ nama: formData.nama, ttl: `${formData.tempat_lahir}, ${formData.tanggal_lahir}`, alamat_rumah: formData.alamat, ukuran_sepatu: formData.ukuran_sepatu }]);
    nextStep(); setLoading(false);
  }

  const updateQuestionsDatabase = async () => {
    setLoading(true);
    // Data Deep Questions + Kesan Pertama digabung ke kolom catatan_bahagia
    const combined = `Rencana: ${formData.pertanyaan_lebaran} | Value: ${formData.pertanyaan_lanjut} | Kesan: ${formData.kesan_pertama}`;
    await supabase.from('responden_thr').update({ catatan_bahagia: combined }).match({ nama: formData.nama });
    nextStep(); setLoading(false);
  }

  const handleFinalSubmitDatabase = async () => {
    setLoading(true);
    await supabase.from('responden_thr').update({ pesan_tambahan: formData.pesan_untuk_rafly }).match({ nama: formData.nama });
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    nextStep(); setLoading(false);
  }

  const uploadFotoDatabase = async () => {
    setLoading(true);
    await supabase.from('responden_thr').update({ foto_selfie: finalStrip }).match({ nama: formData.nama });
    nextStep(); setLoading(false);
  }

  const QuizStep = ({ field, question, options, correctAnswer, onCorrect, forceAll = false }) => {
    const selectedValue = formData[field] || (forceAll ? [] : '')
    
    const handleOptionSelect = (opt) => {
      setQuizFeedback(''); 
      if (forceAll) {
        const newArr = selectedValue.includes(opt) ? selectedValue.filter(i => i !== opt) : [...selectedValue, opt];
        setFormData({...formData, [field]: newArr});
      } else {
        setFormData({...formData, [field]: opt});
      }
    }

    const checkAnswer = () => {
      if (forceAll) {
        if (selectedValue.length === options.length) onCorrect();
        else setQuizFeedback("Yakin nggak pilih semua? Coba lagi yang bener 😤");
      } else {
        if (selectedValue?.toUpperCase() === correctAnswer?.toUpperCase()) onCorrect();
        else {
          setQuizFeedback("Hayo kamu salah!");
          const newLives = lives - 1;
          if (newLives <= 0) { setLives(0); setIsGameOver(true); } else setLives(newLives);
        }
      }
    }

    if (isGameOver) return ( <div className="text-center bg-black/90 p-10 rounded-[40px] text-white space-y-6 border-4 border-red-500 font-poppins"><h2 className="text-6xl font-black italic text-red-500 animate-pulse uppercase">Game Over</h2><button onClick={() => { setLives(3); setIsGameOver(false); setStep(7); }} className="px-12 py-4 bg-white text-black font-black rounded-full shadow-md active:scale-95 transition-all text-center">ULANGI KUIS</button></div> );
    return ( <motion.div animate={quizFeedback !== '' ? { x: [-10, 10, -10, 10, 0] } : {}} transition={{ duration: 0.4 }} className="w-full max-w-lg bg-white p-8 md:p-10 rounded-[40px] shadow-2xl space-y-5 text-[#2D3648] font-poppins">
        <h3 className="font-bold text-xl mb-4 leading-tight text-center">{question}</h3>
        <div className="space-y-3">
          {options.map((opt) => ( 
            <label key={opt} className={`flex items-center p-4 border-2 rounded-2xl cursor-pointer transition-all ${forceAll ? (selectedValue.includes(opt) ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100') : (selectedValue === opt ? 'border-emerald-500 bg-emerald-50' : 'border-gray-100 hover:border-emerald-300')}`}>
              <input type="checkbox" className="hidden" checked={forceAll ? selectedValue.includes(opt) : selectedValue === opt} onChange={() => handleOptionSelect(opt)} />
              <span className="text-base font-medium">{opt}</span>
            </label> 
          ))}
        </div>
        {quizFeedback !== '' && <p className="text-red-500 text-sm italic font-bold text-center">* {quizFeedback}</p>}
        <button onClick={checkAnswer} className="w-full py-4 bg-[#3C3D3E] text-white font-bold rounded-2xl hover:bg-black transition-all shadow-md active:scale-95">Lanjutkan</button>
      </motion.div> );
  }

  const steps = [
    { id: 'landing', content: ( <div className="text-center w-full max-w-xl px-4 flex flex-col items-center font-poppins text-center"><h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-md">Selamat Datang di</h1><p className="text-xl md:text-2xl text-gray-200 mt-1 italic font-medium tracking-tight">bahagi<span className="font-bold text-white">azel</span>alu.com</p><div className="w-full mt-8 p-8 md:p-10 bg-white rounded-[32px] shadow-xl text-gray-800"><p className="text-lg leading-relaxed font-normal">Sebuah platform website agar azel bisa terus bahagia, jangan sedih lagi, jangan prengat prengut, jangan bete, jangan marah marah wae</p><button onClick={() => { if (audioRef.current) { audioRef.current.play().catch(() => {}); setIsPlaying(true); } nextStep(); }} className="mt-8 px-8 py-4 bg-[#3C3D3E] text-white font-bold rounded-full hover:bg-black active:scale-95 transition-all shadow-lg">Start Here to Unlock Your Happiness</button></div><p className="text-xs md:text-sm text-gray-300 mt-10 italic">Created with love by Rafly Rizqi Darmawansyah</p></div> )},
    { id: 'kyc', content: ( <div className="text-center w-full max-w-lg px-4 flex flex-col items-center text-[#2D3648] font-poppins"><h1 className="text-4xl md:text-5xl font-extrabold text-white mb-6 drop-shadow-md text-center">Buat Akun Dulu</h1><div className="w-full p-8 md:p-10 bg-white rounded-[32px] shadow-xl text-left space-y-4 font-poppins">
      <div><label className="text-sm font-bold">Nama Lengkap <span className="text-red-500 font-bold">*</span></label><input type="text" value={formData.nama} placeholder="(boleh kenalan lagi kan?)" className="w-full p-3.5 border-2 border-[#2D3648] rounded-xl outline-none focus:border-emerald-500 text-gray-800" onChange={(e) => setFormData({...formData, nama: e.target.value})} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-sm font-bold">Tempat Lahir <span className="text-red-500 font-bold">*</span></label><input type="text" value={formData.tempat_lahir} placeholder="Kota" className="w-full p-3.5 border-2 border-[#2D3648] rounded-xl outline-none focus:border-emerald-500 text-gray-800" onChange={(e) => setFormData({...formData, tempat_lahir: e.target.value})} /></div>
        <div><label className="text-sm font-bold">Tgl Lahir <span className="text-red-500 font-bold">*</span></label><input type="date" value={formData.tanggal_lahir} className="w-full p-3.5 border-2 border-[#2D3648] rounded-xl outline-none focus:border-emerald-500 bg-white text-gray-800" onChange={(e) => setFormData({...formData, tanggal_lahir: e.target.value})} /></div>
      </div>
      <div><label className="text-sm font-bold">Alamat Rumah <span className="text-red-500 font-bold">*</span></label><input type="text" value={formData.alamat} placeholder="(aku gatau kak rumahnya dimana)" className="w-full p-3.5 border-2 border-[#2D3648] rounded-xl outline-none focus:border-emerald-500 text-gray-800" onChange={(e) => setFormData({...formData, alamat: e.target.value})} /></div>
      <div><label className="text-sm font-bold">Ukuran Sepatu <span className="text-red-500 font-bold">*</span></label><select className="w-full p-3.5 border-2 border-[#2D3648] rounded-xl outline-none focus:border-emerald-500 bg-white text-gray-800 font-poppins" value={formData.ukuran_sepatu} onChange={(e) => setFormData({...formData, ukuran_sepatu: e.target.value})} ><option value="" disabled>(pilih ukuran)</option>{[...Array(11)].map((_, i) => (<option key={i} value={String(35 + i)}>{35 + i}</option>))}</select></div>
      <button onClick={handleSubmitInitial} disabled={!isFormValid || loading} className={`w-full mt-4 py-4 text-xl font-bold rounded-[16px] transition-all flex justify-center items-center ${isFormValid ? 'bg-[#3C3D3E] text-white hover:bg-black shadow-lg' : 'bg-gray-200 text-gray-400'}`}>Lanjutkan</button></div></div> )},
    { id: 'envelope', content: ( <div className="relative bg-[#E9D5B4] p-12 md:p-16 rounded-b-xl shadow-2xl border-x-8 border-b-8 border-[#C4A484] overflow-hidden text-center max-w-2xl font-poppins"><div className="bg-white p-10 md:p-14 rounded-sm shadow-inner transform rotate-[-1deg] relative z-10 text-gray-800 font-poppins text-center text-center"><p className="text-xl md:text-2xl font-medium mb-6">Let’s see how this is going</p><button onClick={nextStep} className="text-2xl md:text-3xl font-black text-black underline underline-offset-8 font-poppins text-center">Tap here</button></div><div className="absolute inset-x-0 bottom-0 h-4" style={{ backgroundImage: 'linear-gradient(45deg, #cc0000 25%, transparent 25%, transparent 50%, #000099 50%, #000099 75%, transparent 75%, transparent)', backgroundSize: '40px 40px' }}></div></div> )},
    { id: 'kilas-balik', content: ( <div className="w-full max-w-4xl px-4 flex flex-col items-center text-white font-poppins text-center">
        <h1 className="text-5xl md:text-7xl font-extrabold mb-2 drop-shadow-lg text-center">Kilas Balik</h1>
        <p className="text-2xl md:text-3xl mb-8 italic drop-shadow-md text-center">Kamis, 26 Februari 2026</p>
        <div className="relative w-full max-w-3xl bg-white/90 p-10 md:p-12 rounded-[40px] shadow-2xl text-[#2D3648] text-center italic font-medium leading-relaxed font-poppins">
          <div className="space-y-4 text-lg text-center">
            <p>This is our first meet, remember?</p>
            <p>2 stranger yang memberanikan diri untuk saling berkenalan dan bertemu.</p>
            <p>Jujurly super canggung, ga ketolong, mo nangis gw saat itu, saking bekunya...</p>
            <p>Siapa sangka di waktu ini aku bertemu kamu, dan kamu bertemu aku. Meski diwarnai dengan musibah wkwk, dan từ situ aku belajar, supaya aku harus selalu siap sedia ke depannya.</p>
            <p>Njir gw jelek bgt cuy sebelum kenal kamu wkwk, bener weh kata keluarga, skrg rafly beda ya...</p>
          </div>
          <button onClick={nextStep} className="absolute -right-6 -bottom-6 w-20 h-20 bg-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-gray-100 shadow-md text-center"><ChevronRight size={48} className="text-[#3C3D3E]" /></button>
        </div>
      </div> )},
    { id: 'kilas-balik-2', content: ( <div className="w-full max-w-4xl px-4 flex flex-col items-center text-center font-poppins text-center"><h1 className="text-5xl md:text-7xl font-extrabold text-white mb-2 drop-shadow-lg text-center font-poppins">Kilas Balik</h1><p className="text-2xl md:text-3xl text-gray-200 mb-8 italic drop-shadow-md text-center text-center">Kamis, 26 Februari 2026</p><div className="relative w-full max-w-3xl bg-white p-10 md:p-12 rounded-[40px] shadow-2xl text-[#2D3648] space-y-6 text-center text-center"><p className="md:text-lg italic font-medium text-gray-700 text-center">Tapi kamu ga nganggep aku autis kan yaa WKWKWK, jujur yaaa, feel free aja kesan pertemuan pertamanya yaaa, atau kesan selama kamu temenan sama aku hehe pliss</p><textarea placeholder="ketik disini..." value={formData.kesan_pertama} className="w-full h-40 p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-emerald-500 text-gray-800 transition-all font-poppins text-center" onChange={(e) => setFormData({...formData, kesan_pertama: e.target.value})} /><button onClick={nextStep} disabled={formData.kesan_pertama.trim() === ''} className={`w-full py-4 text-white font-bold rounded-2xl transition-all ${formData.kesan_pertama.trim() !== '' ? 'bg-[#3C3D3E] hover:bg-black shadow-md' : 'bg-gray-200 cursor-not-allowed'}`}>Lanjutkan</button></div></div> )},
    { id: 'jujurly', content: ( <div className="w-full max-w-6xl px-6 grid grid-cols-1 md:grid-cols-2 gap-10 items-center font-poppins">
        <div className="flex flex-col items-center md:items-start text-white text-left">
          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-center">Jujurly...</h1>
          <div className="w-full bg-white/95 p-8 md:p-10 rounded-[32px] shadow-2xl text-[#2D3648] space-y-6 text-left">
            <div className="italic font-medium text-gray-700 leading-relaxed space-y-4 text-lg text-left text-left">
              <p>Aku mengira hubungan kita bakal berakhir setelah kita pulang dari sini. Itu titik paling ovt aku terkait asmara, mungkin masih canggung juga si bawaannya saat itu... dan aku kek merasa bersalah.</p>
              <p>but thanks, kamu banyak mengajariku dan juga mereach-out kembali hubungan kita</p>
            </div>
            <button onClick={nextStep} className="w-full py-4 bg-[#3C3D3E] text-white font-bold rounded-2xl hover:bg-black active:scale-95 transition-all shadow-md text-center">Lanjutkan</button>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <img src="/ss-chat.jpg" className="w-64 md:w-80 rounded-[32px] shadow-2xl border-4 border-white transform rotate-3" />
          <div className="text-white text-right leading-none uppercase mt-6 text-right"><p className="text-9xl font-black drop-shadow-lg text-right">LOL</p><p className="text-4xl font-bold tracking-widest drop-shadow-md text-right">moments btw</p></div>
        </div>
      </div> )},
    { id: 'kuis-start', content: ( <div className="text-center text-white space-y-6 uppercase font-black italic font-poppins"><h1 className="text-6xl md:text-9xl tracking-tighter drop-shadow-lg text-center text-center">It's Time for THR</h1><p className="text-4xl md:text-6xl font-light text-center text-center">Teka-Teki Hari Raya</p><button onClick={nextStep} className="bg-white text-gray-900 px-16 py-4 rounded-full text-2xl font-bold hover:scale-105 transition-all shadow-2xl mt-10 font-poppins shadow-lg text-center">Let's Get Started</button></div> )},
    // KUIS (7-15)
    { id: 'q1', content: <QuizStep field="q1" question="Nama Lengkap Aku (KAPITAL)" options={["RAFLI RIZKY DARMAWANSYAH", "RAFLY RIZQI DARMAWANSYAH", "RAFLI RIZQY DARMAWANSYAH", "RAFLY RIZQY DARMAWANSYAH"]} correctAnswer="RAFLY RIZQI DARMAWANSYAH" onCorrect={nextStep} /> },
    { id: 'q2', content: <QuizStep field="q2" question="Jurusan Aku Apa Nih?" options={["S1 TEKNIK ELEKTRO", "S1 TEKNIK TELEKOMUNIKASI", "S1 TEKNIK INFORMATIKA", "S1 TEKNIK KOMPUTER"]} correctAnswer="S1 TEKNIK ELEKTRO" onCorrect={nextStep} /> },
    { id: 'q3', content: <QuizStep field="q3" question="Aku anak keberapa dari berapa saudara?" options={["ANAK KE 1 DARI 2 BERSAUDARA", "ANAK KE 2 DARI 3 BERSAUDARA", "ANAK KE 3 DARI 3 BERSAUDARA", "ANAK TUNGGAL"]} correctAnswer="ANAK KE 2 DARI 3 BERSAUDARA" onCorrect={nextStep} /> },
    { id: 'q4', content: <QuizStep field="q4" question="Apakah Rafly pernah pacaran?" options={["PERNAH LAH", "BELUM PERNAH", "MOAL BEJA BEJA", "BANYAK MANTANNYA"]} correctAnswer="BELUM PERNAH" onCorrect={nextStep} /> },
    { id: 'q5', content: <QuizStep field="q5" question="Tebak Hobi Aku!" options={["FOTOGRAFI", "GANGGUIN AZEL", "CODING", "TIDUR"]} correctAnswer="FOTOGRAFI" onCorrect={nextStep} /> },
    { id: 'q6', content: <QuizStep field="q6" question="Nama Lab Aku Sekarang Apa?" options={["SISGRID LABORATORY", "LAB FISIKA DASAR", "LAB ELEKTRONIKA", "POWER SYSTEM LAB"]} correctAnswer="SISGRID LABORATORY" onCorrect={nextStep} /> },
    { id: 'q7', content: <QuizStep field="q7" question="Nama Lab Aku Yang Dulu Apa?" options={["SISGRID LABORATORY", "LABORATORIUM FISIKA DASAR", "LAB ELEKTRONIKA", "LAB DASAR KOMPUTER"]} correctAnswer="LABORATORIUM FISIKA DASAR" onCorrect={nextStep} /> },
    { id: 'q8', content: <QuizStep field="q8" forceAll={true} question="Apakah Azel Single?" options={["SINGLE", "JOMBLO"]} onCorrect={nextStep} /> },
    { id: 'q9', content: <QuizStep field="q9" forceAll={true} question="Apakah Kamu Bahagia Sama Aku?" options={["YA", "BAHAGIA BANGET", "AKU BERSYUKUR KETEMU KAMU"]} onCorrect={nextStep} /> },

    { id: 'deep-questions', content: ( <div className="w-full max-w-2xl bg-white p-10 rounded-[40px] shadow-2xl space-y-8 text-[#2D3648] font-poppins text-center text-center text-center">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-center">Deep Questions For Azel ✨</h2>
        <div className="space-y-6 text-left">
          <div className="space-y-2"><label className="font-bold text-base">1. Satu hal yang Azel pengen lakuin bareng Rafly setelah lebaran ini?</label><textarea value={formData.pertanyaan_lebaran} className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-emerald-500 font-poppins text-center text-center text-center" onChange={(e)=>setFormData({...formData, pertanyaan_lebaran: e.target.value})} /></div>
          <div className="space-y-2"><label className="font-bold text-base">2. Masih pengen mengusahakan hubungan kita lanjut? Apa value rafly yang bikin kamu tertarik berteman?</label><textarea value={formData.pertanyaan_lanjut} className="w-full p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-emerald-500 font-poppins text-center text-center text-center" onChange={(e)=>setFormData({...formData, pertanyaan_lanjut: e.target.value})} /></div>
        </div>
        <button onClick={updateQuestionsDatabase} className="w-full py-4 bg-black text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg text-center text-center text-center text-center">Lanjutkan</button>
      </div> )},
    { id: 'final-msg', content: ( <div className="w-full max-w-lg bg-white p-10 rounded-[40px] shadow-2xl space-y-6 text-[#2D3648] text-center font-poppins"><label className="block font-bold text-xl leading-tight">Sampaikan Pesan Untuk Rafly ✨</label><textarea placeholder="(ketik disini)" value={formData.pesan_untuk_rafly} className="w-full h-40 p-4 border-2 border-gray-100 rounded-2xl outline-none focus:border-emerald-500 text-gray-800 font-poppins text-center text-center text-center" onChange={(e)=>setFormData({...formData, pesan_untuk_rafly: e.target.value})} /><button onClick={handleFinalSubmitDatabase} className="w-full py-4 bg-[#3C3D3E] text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg text-center">Klaim Kebahagianmu</button></div> )},
    { id: 'congrats', content: ( <div className="text-center text-white space-y-4 flex flex-col items-center max-w-4xl font-poppins text-center text-center text-center"><img src="/qr-thr.jpeg" className="w-40 h-40 md:w-56 md:h-56 bg-white p-3 rounded-[28px] shadow-2xl mb-4 shadow-lg object-contain" alt="QR THR" /><h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase drop-shadow-2xl leading-none text-center">CONGRATULATIONS</h1><div className="space-y-1 text-center"><p className="text-lg md:text-xl font-light italic opacity-90 text-center">You've Completed The Task, This is THR for U,</p><p className="text-xl md:text-3xl font-black italic underline underline-offset-4 decoration-white text-center">MOST BEAUTIFUL GIRL IN THIS PLANET</p></div><button onClick={nextStep} className="mt-8 bg-white text-black p-6 rounded-full shadow-2xl active:scale-95 hover:scale-110 transition-transform shadow-lg"><ChevronRight size={40} /></button></div> )},
    
    { id: 'camera-step', content: (
      <div className="text-center w-full max-w-xl bg-white p-8 rounded-[40px] shadow-2xl space-y-4 text-[#2D3648] font-poppins text-center">
        <h2 className="text-2xl font-bold uppercase tracking-tighter text-center">ABADIKAN MOMEN INI 📸</h2>
        <div className="relative overflow-hidden rounded-3xl bg-black aspect-[3/4] border-4 border-gray-100 flex items-center justify-center text-center text-center">
          <AnimatePresence>{isFlashing && ( <motion.div initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.3 }} className="absolute inset-0 bg-white z-50 text-center text-center" /> )}</AnimatePresence>
          {!finalStrip ? (
            <>
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover mirror" />
              {isCounting && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-center"><span className="text-white text-9xl font-black animate-ping text-center">{countdown}</span></div>}
              {isGenerating && <div className="absolute inset-0 flex items-center justify-center bg-white/90 font-bold text-lg text-center">Lagi Nyetak Kartu... ⏳</div>}
              {!isCounting && !isGenerating && photos.length === 0 && <button onClick={startPhotobooth} className="absolute bottom-6 p-5 bg-white rounded-full shadow-xl active:scale-95 shadow-lg text-center"><Camera size={32}/></button>}
              <div className="absolute top-4 left-4 flex flex-col gap-1.5">{[...Array(3)].map((_, i) => ( <div key={i} className={`w-3.5 h-3.5 rounded-full border border-white/50 ${i < photos.length ? 'bg-emerald-500 shadow-md' : 'bg-white/30'}`} /> ))}</div>
            </>
          ) : ( <img src={finalStrip} className="w-full h-full object-contain" /> )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <button onClick={uploadFotoDatabase} disabled={!finalStrip || loading} className={`w-full py-4 text-white font-bold rounded-2xl transition-all ${finalStrip ? 'bg-black active:scale-95 shadow-lg text-center' : 'bg-gray-300 text-center'}`}>{loading ? "Mengirim..." : "Simpan Foto & Lanjut"}</button>
        {finalStrip && !loading && ( <button onClick={() => { setPhotos([]); setFinalStrip(null); startCamera(); }} className="mt-4 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-full text-sm flex items-center gap-2.5 transition-all shadow-sm active:scale-95 shadow-md text-center"><RefreshCw size={16} />RETAKE PHOTOBOOTH</button> )}
      </div>
    )},

    { id: 'deep-msg', content: (
      <div className="w-full max-w-4xl text-white text-right space-y-6 p-8 md:p-12 drop-shadow-2xl font-poppins">
        <div className="space-y-6 text-right">
          <p className="text-2xl md:text-5xl font-black leading-tight tracking-tight text-right">Bahagia selalu ya zel, makasih udah hidupin mimpi mimpi aku, jati diriku, dan senyumanku. Aku selalu berterima kasih dan bahagia dikenalkan dengan sosok <span className="underline decoration-white underline-offset-4 text-right">Azallia Neiyva Safaniya</span>.</p>
          <p className="text-lg md:text-2xl italic opacity-95 text-right">Mimpi apa aku bisa bertemu dengan kamu, hehe. Jika hubungan ini terus berlanjut, kita sama sama nyaman, yaa aku ingin kita ke arah lebih serius aja.</p>
          <p className="text-base md:text-xl font-black uppercase tracking-widest leading-relaxed text-right">Apapun kedepannya, aku ingin kamu selalu bahagia, karena kalau kamu bahagia, aku pun juga akan turut bahagia</p>
          <p className="text-base md:text-lg italic opacity-90 text-right text-right">Kalau ada apa apa, jangan sungkan cerita yaa, aku selalu takut kamu kenapa napa.</p>
        </div>
        <button onClick={nextStep} className="bg-white text-black p-6 rounded-full shadow-2xl mt-8 active:scale-95 shadow-lg text-center"><ChevronRight size={36} /></button>
      </div>
    )},

    { id: 'lebaran', content: (
      <div className="text-center w-full text-white space-y-10 max-w-7xl px-10 drop-shadow-2xl flex flex-col items-center justify-center font-poppins text-center text-center">
        {finalStrip && (
          <div className="flex flex-col items-center gap-4">
            <motion.img initial={{ scale: 0, rotate: -20, y: 50 }} animate={{ scale: 1, rotate: -5, y: 0 }} transition={{ type: 'spring' }} src={finalStrip} className="w-48 md:w-64 shadow-2xl border-8 border-white mb-4 rotate-[-5deg] shadow-lg" />
            <button onClick={downloadImage} className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-bold rounded-full flex items-center gap-2 transition-all active:scale-95 shadow-xl border border-white/40 shadow-md"><Download size={20} />Simpan ke Galeri</button>
          </div>
        )}
        <h2 className="text-4xl md:text-[80px] font-black leading-[1] uppercase tracking-tighter italic animate-pulse text-center">SELAMAT HARI RAYA IDUL FITRI, MINAL AIDZIN WAL FAIDZIN, MOHON MAAF LAHIR DAN BATIN. MAAFKAN KALAU RAFLY ADA SALAH YAA ❤️</h2>
        <p className="text-xl md:text-2xl opacity-80 mt-6 text-center">— With Love, Rafly Rizqi Darmawansyah</p>
      </div>
    )}
  ]

  useEffect(() => { if(step === 19) startCamera(); }, [step]);

  return (
    <main className="relative min-h-screen flex items-center justify-center p-5 overflow-hidden font-poppins text-center text-center">
      <audio ref={audioRef} src={currentSong} loop />
      <div className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ${step >= 18 ? 'scale-100' : 'scale-110'}`} style={{ backgroundImage: (step >= 6) ? "url('/kuis-bg.jpg')" : (step === 5) ? "url('/jujurly.jpg')" : "url('/background-azel.jpg')" }} />
      <div className={`absolute inset-0 bg-black/45 transition-all duration-1000 ${ (step === 3 || step === 5 || step >= 18) ? 'backdrop-blur-none' : 'backdrop-blur-[16px]' }`} />
      {step >= 7 && step <= 15 && !isGameOver && ( <div className="fixed top-8 right-8 z-50 flex gap-2">{[...Array(3)].map((_, i) => ( <Heart key={i} fill={i < lives ? "#ef4444" : "none"} color={i < lives ? "#ef4444" : "white"} size={32} className="drop-shadow-lg transition-all shadow-md shadow-md" /> ))}</div> )}
      <div className="relative z-10 w-full flex justify-center h-full items-center text-center text-center"><AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, scale: 0.92, y: 25 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 1.08, y: -25 }} transition={{ duration: 0.45 }} className="w-full flex justify-center text-center text-center">{steps[step]?.content}</motion.div></AnimatePresence></div>
      {((step > 1 && step < 7) || (step > 17 && step < 21)) && !isGameOver && step !== 19 && ( <button onClick={prevStep} className="fixed bottom-8 left-8 z-50 p-5 bg-white/10 backdrop-blur-md rounded-full text-white shadow-xl hover:bg-white/20 active:scale-95 transition-all shadow-md shadow-lg shadow-lg shadow-lg"><ChevronLeft size={28} /></button> )}
      {isPlaying && ( <button onClick={togglePlay} className="fixed bottom-8 right-8 z-50 p-5 bg-white/20 backdrop-blur-md rounded-full text-white shadow-xl hover:bg-white/30 active:scale-95 transition-all shadow-md shadow-lg shadow-lg shadow-lg text-center">{isPlaying ? <Music size={28} className="animate-spin-slow" /> : <MicOff size={28} />}</button> )}
    </main>
  )
}