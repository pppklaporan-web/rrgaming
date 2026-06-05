import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyBUmvcfP0P47OShnzbMocZVdBT7nU_nSgk",
  authDomain: "bookingpcrrg.firebaseapp.com",
  projectId: "bookingpcrrg",
  storageBucket: "bookingpcrrg.firebasestorage.app",
  messagingSenderId: "711635585570",
  appId: "1:711635585570:web:961168f2115e8c78f2587b",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= GLOBAL ================= */
let operatorTerpilih = "";
let masterBarangDariCloud = [];
let stokMasukShift = [];

const URUTAN_EXCEL = [
  "MILD BKS",
  "SLAVA BTG",
  "MILD BTG",
  "SURYA BTG",
  "M2000",
  "M3000",
  "M4000",
  "M5000",
  "M6000",
  "M10000",
  "SNACK",
  "V20",
  "V30",
  "V50",
  "V100ww",
];

/* ================= OPERATOR ================= */
window.pilihOperator = async function (nama) {
  operatorTerpilih = nama;

  document.getElementById("opFarhan").classList.remove("active");
  document.getElementById("opAdit").classList.remove("active");

  if (nama === "FARHAN")
    document.getElementById("opFarhan").classList.add("active");
  if (nama === "ADIT")
    document.getElementById("opAdit").classList.add("active");

  document.getElementById("areaFormInput").style.display = "block";

  await tarikStokTerupdateDariCloud();
};

/* ================= AMBIL DATA ================= */
async function tarikStokTerupdateDariCloud() {
  const tbody = document.getElementById("badanTabelKasir");

  tbody.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;

  masterBarangDariCloud = [];
  stokMasukShift = {};

  try {
    const querySnapshot = await getDocs(collection(db, "Produk"));

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      masterBarangDariCloud.push({
        id: docSnap.id,
        ...data,
      });

      stokMasukShift[data.nama_produk] = data.stok_saat_ini;
    });

    masterBarangDariCloud.sort((a, b) => {
      let idxA = URUTAN_EXCEL.indexOf(a.nama_produk.toUpperCase().trim());
      let idxB = URUTAN_EXCEL.indexOf(b.nama_produk.toUpperCase().trim());

      if (idxA === -1) idxA = 99;
      if (idxB === -1) idxB = 99;

      return idxA - idxB;
    });

    tbody.innerHTML = "";

    masterBarangDariCloud.forEach((item) => {
      tbody.innerHTML += `
    <tr>
      <td style="text-align: left;">${item.nama_produk}</td>
      <td><input class="input-stok" id="stokIn-${item.id}" value="${item.stok_saat_ini}" disabled></td>
      <td><input class="input-stok" id="stokOut-${item.id}" type="number" placeholder="Sisa"></td>
      
      <td class="kolom-tambah-stok" style="display:none;">
        <div style="display:flex; gap:5px;">
           <input class="input-stok" id="tambah-${item.id}" type="number" placeholder="0">
           <button onclick="window.tambahStok('${item.id}')">+</button>
        </div>
      </td>
    </tr>
  `;
    });
  } catch (err) {
    console.error(err);
  }
}

/* ================= VALIDASI ================= */
window.validasiStokSisa = function (input, stokIn) {
  if (Number(input.value) > Number(stokIn)) {
    alert("Stok tidak valid");
    input.value = "";
  }
};

/* ================= TAMBAH STOK ================= */
window.tambahStok = async function (id) {
  const inputEl = document.getElementById(`tambah-${id}`);
  const tambahan = parseInt(inputEl.value);

  if (!tambahan || tambahan <= 0) {
    Swal.fire("Error", "Masukkan jumlah stok yang valid!", "error");
    return;
  }

  try {
    const item = masterBarangDariCloud.find((p) => p.id === id);
    const stokBaru = item.stok_saat_ini + tambahan;

    // Update Firebase
    await updateDoc(doc(db, "Produk", id), {
      stok_saat_ini: stokBaru,
    });

    // Update Tampilan (UI)
    item.stok_saat_ini = stokBaru;
    document.getElementById(`stokIn-${id}`).value = stokBaru; // Update input stok awal
    inputEl.value = ""; // Reset input tambah

    Swal.fire("Berhasil", "Stok telah ditambah", "success");
  } catch (err) {
    console.error(err);
    Swal.fire("Gagal", "Terjadi kesalahan sistem", "error");
  }
};
/* ================= SHIFT CLOSE ================= */
window.prosesKunciDanUpdateShift = async function () {
  // 1. Ambil input dan berikan validasi jika kosong
  const recehInput =
    Number(document.getElementById("recehDitinggal")?.value) || 0;
  const fisikInput = Number(document.getElementById("fisikLaci")?.value) || 0;

  if (!operatorTerpilih) {
    Swal.fire("Peringatan", "Pilih operator terlebih dahulu!", "warning");
    return;
  }

  if (fisikInput === 0) {
    Swal.fire("Peringatan", "Mohon isi nominal Uang Fisik di Laci!", "warning");
    return;
  }

  // Gunakan loading agar user tahu sistem sedang bekerja
  Swal.fire({
    title: "Menyimpan data...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  let totalKonsumsi = 0;
  let stokOutShift = {};

  try {
    // 2. Gunakan Promise.all untuk update stok secara efisien (lebih cepat & aman)
    const updatePromises = masterBarangDariCloud.map(async (item) => {
      const stokSisa =
        Number(document.getElementById(`stokOut-${item.id}`)?.value) || 0;
      const terjual = item.stok_saat_ini - stokSisa;

      totalKonsumsi += terjual * (Number(item.harga_jual) || 0);
      stokOutShift[item.nama_produk] = stokSisa;

      // Update stok ke Firebase
      return updateDoc(doc(db, "Produk", item.id), {
        stok_saat_ini: stokSisa,
      });
    });

    // Tunggu semua update selesai
    await Promise.all(updatePromises);

    // Pastikan semua input diambil sebagai angka
    const billingCash =
      Number(document.getElementById("billingCash")?.value) || 0;
    const billingQris =
      Number(document.getElementById("billingQris")?.value) || 0;
    const fisikLaci = Number(document.getElementById("fisikLaci")?.value) || 0;

    const totalPendapatan = billingCash + billingQris + totalKonsumsi;
    const selisih = fisikLaci - totalPendapatan;

    // 4. Simpan ke koleksi "Shift"
    await addDoc(collection(db, "Shift"), {
      operator: operatorTerpilih,
      receh_ditinggal: recehInput,
      fisik_laci: fisikInput,
      billing_cash: billingCash,
      billing_qris: billingQris,
      konsumsi: totalKonsumsi,
      total_pendapatan: totalPendapatan,
      selisih: selisih,
      stok_out: stokOutShift,
      waktu_simpan: Timestamp.now(),
    });

    Swal.fire(
      "Berhasil",
      "Shift berhasil disimpan dan stok telah diupdate!",
      "success",
    ).then(() => location.reload()); // Reload setelah user klik OK
  } catch (err) {
    console.error("Error saat menyimpan:", err);
    Swal.fire("Gagal", "Terjadi kesalahan sistem: " + err.message, "error");
  }
};

/* ================= PREVIEW ================= */
document.getElementById("btnPreviewShift").onclick = () => {
  let totalKonsumsi = 0;

  if (
    document.getElementById("billingCash").value === "" &&
    document.getElementById("billingQris").value === ""
  ) {
    Swal.fire(
      "Peringatan",
      "Mohon isi billing cash atau QRIS terlebih dahulu!",
      "warning",
    );
    return;
  }
  masterBarangDariCloud.forEach((item) => {
    const stokOutInput = document.getElementById(`stokOut-${item.id}`);
    if (!stokOutInput) return;

    const stokSisa = Number(stokOutInput.value) || 0;
    const terjual = item.stok_saat_ini - stokSisa;
    totalKonsumsi += terjual * (Number(item.harga_jual) || 0);
  });

  // Ambil nilai dari input, pastikan ID sesuai dengan kasir.html
  const billingCash =
    Number(document.getElementById("billingCash")?.value) || 0;
  const billingQris =
    Number(document.getElementById("billingQris")?.value) || 0;
  const fisikLaci = Number(document.getElementById("fisikLaci")?.value) || 0;

  const totalPendapatan = billingCash + billingQris + totalKonsumsi;
  const selisih = fisikLaci - totalPendapatan;

  // Update Tampilan dengan memanggil fungsi rupiah()
  document.getElementById("sumBillingCash").textContent = rupiah(billingCash);
  document.getElementById("sumBillingQris").textContent = rupiah(billingQris);
  document.getElementById("sumKonsumsi").textContent = rupiah(totalKonsumsi);
  document.getElementById("sumLaci").textContent = rupiah(fisikLaci);
  document.getElementById("sumSelisih").textContent = rupiah(selisih);
  document.getElementById("sumTotal").textContent = rupiah(totalPendapatan);

  document.getElementById("ringkasanShift").style.display = "block";
};

function rupiah(nilai) {
  return "Rp " + Number(nilai || 0).toLocaleString("id-ID");
}

window.toggleModeTambahStok = function () {
  const kolomTambah = document.querySelectorAll(".kolom-tambah-stok");
  kolomTambah.forEach((el) => {
    // Toggle display antara 'none' dan 'table-cell'
    el.style.display = el.style.display === "none" ? "table-cell" : "none";
  });
};
