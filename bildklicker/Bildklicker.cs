// Bildklicker – sucht ein Bild auf dem Bildschirm und klickt darauf (oder drückt eine Taste), sobald es auftaucht.
// Wird beim Start von Windows PowerShell 5.1 (Add-Type) übersetzt:
// nur C#-5-Schreibweise benutzen (kein $"...", kein ?., keine =>-Eigenschaften)
// und nur System, System.Drawing und System.Windows.Forms (kein LINQ/System.Core).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace Bildklicker
{
    // ------------------------------------------------------------------ Windows-Funktionen
    public static class Nat
    {
        [StructLayout(LayoutKind.Sequential)]
        public struct POINT { public int X; public int Y; }

        [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
        [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, uint data, UIntPtr extra);
        [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
        [DllImport("shcore.dll")] public static extern int SetProcessDpiAwareness(int value);
        [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hwnd, int cmd);

        // Echte Bildschirm-Pixel benutzen (sonst stimmen Fotos und Klicks bei 125 %/150 % Skalierung nicht).
        public static void DpiAware()
        {
            try { if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return; } catch { }
            try { if (SetProcessDpiAwareness(2) == 0) return; } catch { }
            try { SetProcessDPIAware(); } catch { }
        }

        public static void HideConsole()
        {
            try { IntPtr h = GetConsoleWindow(); if (h != IntPtr.Zero) ShowWindow(h, 0); } catch { }
        }

        const uint LDOWN = 0x0002, LUP = 0x0004, RDOWN = 0x0008, RUP = 0x0010;

        // art: 0 = links, 1 = rechts, 2 = Doppelklick (links) – an der aktuellen Mausposition
        public static void ClickHere(int art)
        {
            uint dn = art == 1 ? RDOWN : LDOWN, up = art == 1 ? RUP : LUP;
            mouse_event(dn, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(30); mouse_event(up, 0, 0, 0, UIntPtr.Zero);
            if (art == 2)
            {
                Thread.Sleep(60);
                mouse_event(dn, 0, 0, 0, UIntPtr.Zero); Thread.Sleep(30); mouse_event(up, 0, 0, 0, UIntPtr.Zero);
            }
        }

        public static void Click(int x, int y, int art, bool back)
        {
            POINT old;
            bool hadOld = GetCursorPos(out old);
            SetCursorPos(x, y);
            Thread.Sleep(40);
            ClickHere(art);
            if (back && hadOld) { Thread.Sleep(40); SetCursorPos(old.X, old.Y); }
        }

        // ---- Tastatur (SendInput mit Scancode: funktioniert auch in den meisten Spielen)
        [StructLayout(LayoutKind.Sequential)]
        public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr dwExtraInfo; }
        [StructLayout(LayoutKind.Sequential)]
        public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
        [StructLayout(LayoutKind.Explicit)]
        public struct INPUTU { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
        [StructLayout(LayoutKind.Sequential)]
        public struct INPUT { public uint type; public INPUTU u; }

        [DllImport("user32.dll")] public static extern uint SendInput(uint count, INPUT[] inputs, int size);
        [DllImport("user32.dll")] public static extern uint MapVirtualKey(uint code, uint mapType);

        static bool Extended(int vk)
        {
            switch (vk)
            {
                case 33: case 34: case 35: case 36: case 37: case 38: case 39: case 40:
                case 45: case 46: case 91: case 92: case 93: case 111: case 144: case 163: case 165:
                    return true;
            }
            return false;
        }

        public static void Key(int vk, bool down)
        {
            uint sc = MapVirtualKey((uint)vk, 0);
            INPUT i = new INPUT();
            i.type = 1;
            i.u.ki.wVk = (ushort)vk;
            i.u.ki.wScan = (ushort)sc;
            uint fl = down ? 0u : 0x0002u;
            if (sc != 0) fl |= 0x0008u;
            if (Extended(vk)) fl |= 0x0001u;
            i.u.ki.dwFlags = fl;
            SendInput(1, new INPUT[] { i }, Marshal.SizeOf(typeof(INPUT)));
        }

        public static void Tap(int vk)
        {
            Key(vk, true); Thread.Sleep(50); Key(vk, false);
        }
    }

    // ------------------------------------------------------------------ Bilddaten
    public class Pix
    {
        public int W, H;
        public byte[] B;   // Blau, Grün, Rot, Alpha je Pixel
        public int[] G;    // Grauwert 0..255 je Pixel

        public void Load(Bitmap bmp)
        {
            int w = bmp.Width, h = bmp.Height;
            if (B == null || W != w || H != h) { W = w; H = h; B = new byte[w * h * 4]; G = new int[w * h]; }
            BitmapData d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            try
            {
                if (d.Stride == w * 4) Marshal.Copy(d.Scan0, B, 0, B.Length);
                else for (int y = 0; y < h; y++) Marshal.Copy(new IntPtr(d.Scan0.ToInt64() + (long)y * d.Stride), B, y * w * 4, w * 4);
            }
            finally { bmp.UnlockBits(d); }
            for (int i = 0, p = 0; i < G.Length; i++, p += 4) G[i] = (B[p] * 29 + B[p + 1] * 150 + B[p + 2] * 77) >> 8;
        }

        public static Pix Of(Bitmap bmp) { Pix p = new Pix(); p.Load(bmp); return p; }
    }

    public static class Util
    {
        // Pixelgenaue Kopie (immer 32 Bit), ohne Skalierung.
        // Die Quelle wird ganz gesperrt (Teil-Sperren schreiben bei manchen GDI+-Nachbauten falsch zurück).
        public static Bitmap Copy32(Bitmap src, Rectangle r)
        {
            r.Intersect(new Rectangle(0, 0, src.Width, src.Height));
            if (r.Width <= 0 || r.Height <= 0) throw new ArgumentException("Ausschnitt liegt außerhalb des Bildes.");
            Bitmap dst = new Bitmap(r.Width, r.Height, PixelFormat.Format32bppArgb);
            BitmapData s = src.LockBits(new Rectangle(0, 0, src.Width, src.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            BitmapData d = dst.LockBits(new Rectangle(0, 0, r.Width, r.Height), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            try
            {
                byte[] row = new byte[r.Width * 4];
                for (int y = 0; y < r.Height; y++)
                {
                    Marshal.Copy(new IntPtr(s.Scan0.ToInt64() + (long)(r.Y + y) * s.Stride + r.X * 4), row, 0, row.Length);
                    Marshal.Copy(row, 0, new IntPtr(d.Scan0.ToInt64() + (long)y * d.Stride), row.Length);
                }
            }
            finally { src.UnlockBits(s); dst.UnlockBits(d); }
            return dst;
        }

        public static Bitmap Copy32(Image img)
        {
            using (Bitmap b = new Bitmap(img)) return Copy32(b, new Rectangle(0, 0, b.Width, b.Height));
        }

        public static Bitmap LoadFile(string path)
        {
            using (FileStream fs = File.OpenRead(path))
            using (Image img = Image.FromStream(fs))
                return Copy32(img);
        }

        // Alpha auf 255 setzen (Bildschirmfotos haben manchmal Alpha 0).
        public static void Opaque(Bitmap b)
        {
            Rectangle r = new Rectangle(0, 0, b.Width, b.Height);
            BitmapData d = b.LockBits(r, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            try
            {
                byte[] row = new byte[b.Width * 4];
                for (int y = 0; y < b.Height; y++)
                {
                    IntPtr p = new IntPtr(d.Scan0.ToInt64() + (long)y * d.Stride);
                    Marshal.Copy(p, row, 0, row.Length);
                    for (int i = 3; i < row.Length; i += 4) row[i] = 255;
                    Marshal.Copy(row, 0, p, row.Length);
                }
            }
            finally { b.UnlockBits(d); }
        }

        // Name einer Taste auf Deutsch (für die Anzeige)
        public static string KeyName(int vk)
        {
            Keys k = (Keys)vk;
            if (k >= Keys.A && k <= Keys.Z) return k.ToString();
            if (k >= Keys.D0 && k <= Keys.D9) return ((char)('0' + (vk - (int)Keys.D0))).ToString();
            if (k >= Keys.NumPad0 && k <= Keys.NumPad9) return "Ziffernblock " + (vk - (int)Keys.NumPad0);
            if (k >= Keys.F1 && k <= Keys.F24) return k.ToString();
            switch (k)
            {
                case Keys.Space: return "Leertaste";
                case Keys.Enter: return "Enter";
                case Keys.ShiftKey: case Keys.LShiftKey: case Keys.RShiftKey: return "Umschalt";
                case Keys.ControlKey: case Keys.LControlKey: case Keys.RControlKey: return "Strg";
                case Keys.Menu: case Keys.LMenu: case Keys.RMenu: return "Alt";
                case Keys.Escape: return "Esc";
                case Keys.Tab: return "Tab";
                case Keys.Back: return "Rücktaste";
                case Keys.Up: return "Pfeil hoch";
                case Keys.Down: return "Pfeil runter";
                case Keys.Left: return "Pfeil links";
                case Keys.Right: return "Pfeil rechts";
                case Keys.Delete: return "Entf";
                case Keys.Insert: return "Einfg";
                case Keys.Home: return "Pos1";
                case Keys.End: return "Ende";
                case Keys.PageUp: return "Bild hoch";
                case Keys.PageDown: return "Bild runter";
                case Keys.CapsLock: return "Feststelltaste";
            }
            try
            {
                uint ch = Nat.MapVirtualKey((uint)vk, 2) & 0xFFFF;
                if (ch > 32) return ((char)ch).ToString().ToUpper();
            }
            catch { }
            return k.ToString();
        }

        public static string Pct(double s)
        {
            return ((int)Math.Floor(Math.Max(0.0, Math.Min(1.0, s)) * 100.0)).ToString(CultureInfo.InvariantCulture) + " %";
        }
    }

    // Bildschirmfoto über alle Monitore (Puffer werden wiederverwendet).
    public class Grabber : IDisposable
    {
        Bitmap bmp;
        public Pix P = new Pix();
        public Rectangle Area;

        public static Bitmap Shot(Rectangle v)
        {
            Bitmap b = new Bitmap(v.Width, v.Height, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(b)) g.CopyFromScreen(v.Left, v.Top, 0, 0, v.Size, CopyPixelOperation.SourceCopy);
            return b;
        }

        public Pix Grab()
        {
            Rectangle v = SystemInformation.VirtualScreen;
            if (bmp == null || bmp.Width != v.Width || bmp.Height != v.Height)
            {
                if (bmp != null) bmp.Dispose();
                bmp = new Bitmap(v.Width, v.Height, PixelFormat.Format32bppArgb);
            }
            using (Graphics g = Graphics.FromImage(bmp)) g.CopyFromScreen(v.Left, v.Top, 0, 0, v.Size, CopyPixelOperation.SourceCopy);
            Area = v;
            P.Load(bmp);
            return P;
        }

        public void Dispose() { if (bmp != null) bmp.Dispose(); bmp = null; }
    }

    // ------------------------------------------------------------------ Bildsuche
    public class Hit { public int X, Y; public double Score; }

    class Samp
    {
        public int N, OffW = -1;
        public int[] Dx, Dy, Off;
        public byte[] Cb, Cg, Cr;
        public float[] Z;
        public double Norm;
        public bool Flat;
    }

    class Level
    {
        public int F, W, H;
        public float[] Z;
        public double Norm, Mean;
        public bool Flat;
    }

    // Ablauf: Bildschirm und Vorlage verkleinert vergleichen (Graustufen-Korrelation),
    // die 16 besten Stellen in voller Größe nachprüfen (Form UND Farbe müssen passen).
    // Zusätzlich: schnelle Suche nach (fast) pixelgleichen Stellen über seltene Anker-Pixel.
    // Ergebnis: Übereinstimmung 0..1 (1 = pixelgleich).
    public class Matcher
    {
        readonly Pix T;
        readonly Samp quick, full;
        Level lev;
        float[] cs, map;
        double[] i1, i2;
        // Anker-Pixel für die Pixel-genau-Suche (ruhige Stellen der Vorlage)
        int[] apX, apY, apBin;
        byte[] apB, apG, apR;
        bool[] apCalm;
        readonly Samp tiny;
        readonly int[] hist = new int[4096];
        public int AnchorTol = 40;      // erlaubte Farbabweichung je Kanal an Ankern

        public int TW { get { return T.W; } }
        public int TH { get { return T.H; } }
        public double Budget = 4e7;     // Rechenschritte für die Grobsuche
        public static double ColK = 2.0; // Strenge der Farbbewertung (2: 90 % = im Schnitt 5 % Farbabweichung)
        public int LastF;

        public Matcher(Pix t)
        {
            T = t;
            tiny = MakeSamp(64, 4);
            quick = MakeSamp(400, 1);
            full = MakeSamp(6000, 2);
            MakeAnchorPool();
        }

        // Mögliche Anker: alle (deckenden) Pixel. Ruhige Pixel (alle 8 Nachbarn fast gleich)
        // sind robuster gegen JPG und Kantenglättung und werden bevorzugt.
        void MakeAnchorPool()
        {
            int w = T.W, h = T.H;
            List<int> pool = new List<int>();
            for (int i = 0; i < w * h; i++) if (T.B[i * 4 + 3] >= 128 || !HasAlpha()) pool.Add(i);
            if (pool.Count > 6000)
            {
                Random rnd = new Random(3);
                List<int> pick = new List<int>();
                bool[] used = new bool[pool.Count];
                while (pick.Count < 6000) { int k = rnd.Next(pool.Count); if (!used[k]) { used[k] = true; pick.Add(pool[k]); } }
                pool = pick;
            }
            int n = pool.Count;
            apX = new int[n]; apY = new int[n]; apBin = new int[n]; apB = new byte[n]; apG = new byte[n]; apR = new byte[n];
            apCalm = new bool[n];
            for (int k = 0; k < n; k++)
            {
                int i = pool[k], p = i * 4;
                apX[k] = i % w; apY[k] = i / w;
                int x = apX[k], y = apY[k];
                bool calm = x > 0 && y > 0 && x < w - 1 && y < h - 1;
                for (int j = -1; j <= 1 && calm; j++)
                    for (int c = -1; c <= 1 && calm; c++)
                    {
                        int q = ((y + j) * w + x + c) * 4;
                        if (Math.Abs(T.B[q] - T.B[p]) > 12 || Math.Abs(T.B[q + 1] - T.B[p + 1]) > 12 || Math.Abs(T.B[q + 2] - T.B[p + 2]) > 12) calm = false;
                    }
                apCalm[k] = calm;
                apB[k] = T.B[p]; apG[k] = T.B[p + 1]; apR[k] = T.B[p + 2];
                apBin[k] = ((apR[k] >> 4) << 8) | ((apG[k] >> 4) << 4) | (apB[k] >> 4);
            }
        }

        int hasAlpha = -1;
        bool HasAlpha()
        {
            if (hasAlpha < 0)
            {
                int n = T.W * T.H, op = 0;
                for (int i = 0; i < n; i++) if (T.B[i * 4 + 3] >= 128) op++;
                hasAlpha = op >= 16 && op < n ? 1 : 0;
            }
            return hasAlpha == 1;
        }

        // Stichprobe von Vorlagen-Pixeln; durchsichtige Pixel (Alpha < 128) zählen nicht.
        Samp MakeSamp(int max, int seed)
        {
            int n = T.W * T.H;
            int opaque = 0;
            for (int i = 0; i < n; i++) if (T.B[i * 4 + 3] >= 128) opaque++;
            bool useAlpha = opaque >= 16 && opaque < n;
            List<int> pool = new List<int>();
            for (int i = 0; i < n; i++) if (!useAlpha || T.B[i * 4 + 3] >= 128) pool.Add(i);
            List<int> list = new List<int>();
            if (pool.Count <= max) list = pool;
            else
            {
                Random rnd = new Random(seed);
                bool[] used = new bool[pool.Count];
                while (list.Count < max)
                {
                    int k = rnd.Next(pool.Count);
                    if (!used[k]) { used[k] = true; list.Add(pool[k]); }
                }
                list.Sort();
            }
            Samp s = new Samp();
            s.N = list.Count;
            s.Dx = new int[s.N]; s.Dy = new int[s.N]; s.Off = new int[s.N];
            s.Cb = new byte[s.N]; s.Cg = new byte[s.N]; s.Cr = new byte[s.N]; s.Z = new float[s.N];
            double sum = 0;
            for (int k = 0; k < s.N; k++)
            {
                int i = list[k], p = i * 4;
                s.Dx[k] = i % T.W; s.Dy[k] = i / T.W;
                s.Cb[k] = T.B[p]; s.Cg[k] = T.B[p + 1]; s.Cr[k] = T.B[p + 2];
                sum += T.G[i];
            }
            double mean = sum / s.N, ss = 0;
            for (int k = 0; k < s.N; k++) { double d = T.G[list[k]] - mean; s.Z[k] = (float)d; ss += d * d; }
            s.Norm = Math.Sqrt(ss);
            s.Flat = Math.Sqrt(ss / s.N) < 3.0;
            return s;
        }

        Level MakeLevel(int f)
        {
            Level L = new Level();
            L.F = f; L.W = T.W / f; L.H = T.H / f;
            int n = L.W * L.H;
            double[] v = new double[n];
            double sum = 0;
            for (int y = 0; y < L.H; y++)
                for (int x = 0; x < L.W; x++)
                {
                    int a = 0;
                    for (int j = 0; j < f; j++)
                    {
                        int row = (y * f + j) * T.W + x * f;
                        for (int i = 0; i < f; i++) a += T.G[row + i];
                    }
                    double m = a / (double)(f * f);
                    v[y * L.W + x] = m; sum += m;
                }
            L.Mean = sum / n;
            double ss = 0;
            L.Z = new float[n];
            for (int k = 0; k < n; k++) { double d = v[k] - L.Mean; L.Z[k] = (float)d; ss += d * d; }
            L.Norm = Math.Sqrt(ss);
            L.Flat = Math.Sqrt(ss / n) < 3.0;
            return L;
        }

        int ChooseF(int sw, int sh)
        {
            int fmax = Math.Max(1, Math.Min(T.W, T.H) / 6);
            double c = (double)sw * sh * T.W * T.H;
            int f = 1;
            while (f < fmax && c / ((double)f * f * f * f) > Budget) f++;
            return f;
        }

        static bool Hits(Rectangle e, int x, int y, int w, int h)
        {
            return x < e.Right && x + w > e.Left && y < e.Bottom && y + h > e.Top;
        }

        static void SetOff(Samp sp, int sw)
        {
            for (int k = 0; k < sp.N; k++) sp.Off[k] = sp.Dy[k] * sw + sp.Dx[k];
            sp.OffW = sw;
        }

        static double Score(Pix s, int x, int y, Samp sp)
        {
            int[] G = s.G; byte[] B = s.B; int[] off = sp.Off; float[] z = sp.Z;
            byte[] cb = sp.Cb, cg = sp.Cg, cr = sp.Cr;
            int n = sp.N, bas = y * s.W + x;
            double num = 0, a1 = 0, a2 = 0;
            long cd = 0;
            for (int k = 0; k < n; k++)
            {
                int idx = bas + off[k];
                int g = G[idx];
                num += z[k] * g; a1 += g; a2 += g * g;
                int p = idx << 2;
                int d0 = B[p] - cb[k], d1 = B[p + 1] - cg[k], d2 = B[p + 2] - cr[k];
                cd += (d0 < 0 ? -d0 : d0) + (d1 < 0 ? -d1 : d1) + (d2 < 0 ? -d2 : d2);
            }
            double col = 1.0 - ColK * cd / (765.0 * n);
            if (sp.Flat) return col;
            double vr = a2 - a1 * a1 / n;
            double ncc = vr < 0.5 * n ? 0 : num / (sp.Norm * Math.Sqrt(vr));
            return Math.Min(ncc, col);
        }

        // Für Tests: Teilwerte der Bewertung an einer Stelle.
        public void ScoreParts(Pix s, int x, int y, out double ncc, out double col)
        {
            if (full.OffW != s.W) SetOff(full, s.W);
            Samp sp = full;
            double num = 0, a1 = 0, a2 = 0; long cd = 0;
            for (int k = 0; k < sp.N; k++)
            {
                int idx = y * s.W + x + sp.Off[k], g = s.G[idx], p = idx * 4;
                num += sp.Z[k] * g; a1 += g; a2 += g * g;
                cd += Math.Abs(s.B[p] - sp.Cb[k]) + Math.Abs(s.B[p + 1] - sp.Cg[k]) + Math.Abs(s.B[p + 2] - sp.Cr[k]);
            }
            col = 1.0 - ColK * cd / (765.0 * sp.N);
            double vr = a2 - a1 * a1 / sp.N;
            ncc = sp.Flat ? 1 : vr < 0.5 * sp.N ? 0 : num / (sp.Norm * Math.Sqrt(vr));
        }

        public string LastWay = "";

        // ex = Bereich (in Bildschirmfoto-Koordinaten), der nicht durchsucht wird (das eigene Fenster).
        public Hit Find(Pix s, Rectangle ex)
        {
            if (T.W > s.W || T.H > s.H) return null;
            if (quick.OffW != s.W) SetOff(quick, s.W);
            if (full.OffW != s.W) SetOff(full, s.W);
            Hit a = full.Flat ? null : AnchorSearch(s, ex);
            if (a != null && a.Score >= 0.98) { LastWay = "Pixel"; return a; }
            Hit c = CoarseSearch(s, ex);
            LastWay = "Grob";
            if (a != null && (c == null || a.Score >= c.Score)) { LastWay = "Pixel"; return a; }
            return c;
        }

        // Sucht Stellen, an denen die Anker-Pixel (seltene Farben der Vorlage) fast genau passen.
        Hit AnchorSearch(Pix s, Rectangle ex)
        {
            int sw = s.W, tw = T.W, th = T.H, np = apX.Length;
            if (np == 0) return null;
            byte[] B = s.B;

            // Wie häufig ist jede Farbe auf dem Bildschirm? (jedes 4. Pixel genügt)
            Array.Clear(hist, 0, hist.Length);
            for (int p = 0; p < B.Length; p += 16) hist[((B[p + 2] >> 4) << 8) | ((B[p + 1] >> 4) << 4) | (B[p] >> 4)]++;

            // seltenste Farben zuerst, Anker gut verteilt
            int[] key = new int[np], idx = new int[np];
            for (int k = 0; k < np; k++) { key[k] = (hist[apBin[k]] + 1) * (apCalm[k] ? 1 : 3); idx[k] = k; }
            Array.Sort(key, idx);
            // höchstens 3 Anker je Farbe (sonst passen große gleichfarbige Flächen überall)
            const int WANT = 12;
            List<int> ch = new List<int>();
            int md = Math.Max(2, Math.Min(tw, th) / 5), md2 = md * md;
            for (int pass = 0; pass < 3 && ch.Count < WANT; pass++)
                for (int q = 0; q < np && ch.Count < WANT; q++)
                {
                    int k = idx[q], same = 0;
                    bool ok = true;
                    foreach (int c in ch)
                    {
                        int dx = apX[c] - apX[k], dy = apY[c] - apY[k];
                        if (apBin[c] == apBin[k]) same++;
                        if (c == k || (pass == 0 && dx * dx + dy * dy < md2)) { ok = false; break; }
                    }
                    if (ok && pass < 2 && same >= 3) ok = false;
                    if (ok) ch.Add(k);
                }
            int na = ch.Count;
            int[] aOff = new int[na]; int[] aB = new int[na], aG = new int[na], aR = new int[na];
            for (int a = 0; a < na; a++)
            {
                int k = ch[a];
                aOff[a] = (apY[k] * sw + apX[k]) * 4; aB[a] = apB[k]; aG[a] = apG[k]; aR[a] = apR[k];
            }
            int allow = na >= 8 ? 1 : 0, tol = AnchorTol;
            const int KEEP = 40, CAP = 60000;
            double[] ts = new double[KEEP]; int[] ti = new int[KEEP];
            if (tiny.OffW != sw) SetOff(tiny, sw);
            for (int round = 0; round < 2; round++)
            {
                if (round == 1) { allow = 0; tol = tol / 3; }
                for (int k = 0; k < KEEP; k++) { ts[k] = -9; ti[k] = -1; }
                if (ScanAnchors(s, ex, na, aOff, aB, aG, aR, allow, tol, CAP, ts, ti) < CAP) break;
            }
            if (ti[0] < 0) return null;

            // die 40 mit 400 Pixeln nachbewerten, die besten 5 ganz genau
            double[] bs = new double[5]; int[] bi = new int[5];
            for (int k = 0; k < 5; k++) { bs[k] = -9; bi[k] = -1; }
            for (int k = 0; k < KEEP && ti[k] >= 0; k++) Keep(bs, bi, Score(s, ti[k] % sw, ti[k] / sw, quick), ti[k]);
            Hit best = null;
            for (int k = 0; k < 5 && bi[k] >= 0; k++)
            {
                int x = bi[k] % sw, y = bi[k] / sw;
                double v = Score(s, x, y, full);
                if (best == null || v > best.Score) { best = new Hit(); best.X = x; best.Y = y; best.Score = v; }
            }
            return best;
        }

        // Prüft jede Stelle an den Ankern; passende Stellen werden sofort mit 64 Pixeln bewertet
        // (die besten landen in ts/ti). Ergebnis: Anzahl passender Stellen (höchstens cap).
        int ScanAnchors(Pix s, Rectangle ex, int na, int[] aOff, int[] aB, int[] aG, int[] aR, int allow, int tol, int cap, double[] ts, int[] ti)
        {
            int sw = s.W, sh = s.H, tw = T.W, th = T.H;
            byte[] B = s.B;
            bool hasEx = ex.Width > 0 && ex.Height > 0;
            int tested = 0;
            for (int y = 0; y <= sh - th && tested < cap; y++)
            {
                int row = y * sw;
                for (int x = 0; x <= sw - tw; x++)
                {
                    int bp = (row + x) * 4, miss = 0, a;
                    for (a = 0; a < na; a++)
                    {
                        int p = bp + aOff[a];
                        int d0 = B[p] - aB[a], d1 = B[p + 1] - aG[a], d2 = B[p + 2] - aR[a];
                        if (d0 > tol || d0 < -tol || d1 > tol || d1 < -tol || d2 > tol || d2 < -tol)
                        {
                            if (++miss > allow) break;
                        }
                    }
                    if (a < na) continue;
                    if (hasEx && Hits(ex, x, y, tw, th)) continue;
                    tested++;
                    Keep(ts, ti, Score(s, x, y, tiny), row + x);
                    if (tested >= cap) break;
                }
            }
            return tested;
        }

        // sortierte Bestenliste (absteigend) mit fester Länge
        static void Keep(double[] sc, int[] id, double v, int i)
        {
            int n = sc.Length;
            if (v <= sc[n - 1]) return;
            int j = n - 1;
            while (j > 0 && sc[j - 1] < v) { sc[j] = sc[j - 1]; id[j] = id[j - 1]; j--; }
            sc[j] = v; id[j] = i;
        }

        Hit CoarseSearch(Pix s, Rectangle ex)
        {
            int sw = s.W, sh = s.H, tw = T.W, th = T.H;
            int f = ChooseF(sw, sh);
            LastF = f;
            if (lev == null || lev.F != f) lev = MakeLevel(f);
            Level L = lev;
            int cW = sw / f, cH = sh / f;
            int nx = cW - L.W + 1, ny = cH - L.H + 1;
            bool hasEx = ex.Width > 0 && ex.Height > 0;

            // 1) Bildschirm verkleinern (Mittelwert aus f×f Pixeln)
            int cn = cW * cH;
            if (cs == null || cs.Length != cn) cs = new float[cn];
            int[] G = s.G;
            if (f == 1) { for (int i = 0; i < cn; i++) cs[i] = G[i]; }
            else
            {
                float inv = 1f / (f * f);
                int[] acc = new int[cW];
                for (int y = 0; y < cH; y++)
                {
                    Array.Clear(acc, 0, cW);
                    for (int j = 0; j < f; j++)
                    {
                        int row = (y * f + j) * sw;
                        for (int x = 0; x < cW; x++)
                        {
                            int p = row + x * f, a = 0;
                            for (int i = 0; i < f; i++) a += G[p + i];
                            acc[x] += a;
                        }
                    }
                    int o = y * cW;
                    for (int x = 0; x < cW; x++) cs[o + x] = acc[x] * inv;
                }
            }

            // 2) Summen-Tabellen für schnelle Mittelwerte/Streuung
            int iw = cW + 1, isz = iw * (cH + 1);
            if (i1 == null || i1.Length != isz) { i1 = new double[isz]; i2 = new double[isz]; }
            for (int x = 0; x < iw; x++) { i1[x] = 0; i2[x] = 0; }
            for (int y = 0; y < cH; y++)
            {
                double r1 = 0, r2 = 0;
                int o = (y + 1) * iw, src = y * cW;
                i1[o] = 0; i2[o] = 0;
                for (int x = 0; x < cW; x++)
                {
                    double v = cs[src + x];
                    r1 += v; r2 += v * v;
                    i1[o + x + 1] = i1[o - iw + x + 1] + r1;
                    i2[o + x + 1] = i2[o - iw + x + 1] + r2;
                }
            }

            // 3) Grobsuche: Korrelation an jeder Stelle
            int mn = nx * ny;
            if (map == null || map.Length != mn) map = new float[mn];
            int ln = L.W * L.H;
            float[] lz = L.Z, c = cs;
            for (int y = 0; y < ny; y++)
            {
                for (int x = 0; x < nx; x++)
                {
                    int mi = y * nx + x;
                    if (hasEx && Hits(ex, x * f, y * f, tw, th)) { map[mi] = -9; continue; }
                    int a = y * iw + x, b = a + L.W, cc = (y + L.H) * iw + x, d = cc + L.W;
                    double s1 = i1[d] - i1[b] - i1[cc] + i1[a];
                    double s2 = i2[d] - i2[b] - i2[cc] + i2[a];
                    double vr = s2 - s1 * s1 / ln;
                    if (vr < 0) vr = 0;
                    if (L.Flat)
                    {
                        map[mi] = (float)(1.0 - (Math.Abs(s1 / ln - L.Mean) + Math.Sqrt(vr / ln)) / 255.0);
                        continue;
                    }
                    if (vr < 0.5 * ln) { map[mi] = 0; continue; }
                    double num = 0;
                    for (int j = 0; j < L.H; j++)
                    {
                        int so = (y + j) * cW + x, to = j * L.W;
                        for (int i = 0; i < L.W; i++) num += lz[to + i] * c[so + i];
                    }
                    map[mi] = (float)(num / (L.Norm * Math.Sqrt(vr)));
                }
            }

            // 4) Die 16 besten, weit genug auseinanderliegenden Stellen
            List<int> cands = new List<int>();
            int rx = Math.Max(1, L.W / 2), ry = Math.Max(1, L.H / 2);
            for (int k = 0; k < 16; k++)
            {
                int bi = -1; float bv = -2f;
                for (int i = 0; i < mn; i++) if (map[i] > bv) { bv = map[i]; bi = i; }
                if (bi < 0) break;
                cands.Add(bi);
                int cx = bi % nx, cy = bi / nx;
                int y0 = Math.Max(0, cy - ry), y1 = Math.Min(ny - 1, cy + ry);
                int x0 = Math.Max(0, cx - rx), x1 = Math.Min(nx - 1, cx + rx);
                for (int y = y0; y <= y1; y++)
                    for (int x = x0; x <= x1; x++) map[y * nx + x] = -9;
            }

            // 5) In voller Größe nachprüfen
            Hit best = null;
            int r = f == 1 ? 1 : f + (f + 1) / 2;
            foreach (int ci in cands)
            {
                int bx = (ci % nx) * f, by = (ci / nx) * f;
                int qx = -1, qy = -1;
                double qs = -9;
                int ya = Math.Max(0, by - r), yb = Math.Min(sh - th, by + r);
                int xa = Math.Max(0, bx - r), xb = Math.Min(sw - tw, bx + r);
                for (int y = ya; y <= yb; y++)
                    for (int x = xa; x <= xb; x++)
                    {
                        if (hasEx && Hits(ex, x, y, tw, th)) continue;
                        double v = Score(s, x, y, quick);
                        if (v > qs) { qs = v; qx = x; qy = y; }
                    }
                if (qx < 0) continue;
                for (int y = Math.Max(0, qy - 1); y <= Math.Min(sh - th, qy + 1); y++)
                    for (int x = Math.Max(0, qx - 1); x <= Math.Min(sw - tw, qx + 1); x++)
                    {
                        if (hasEx && Hits(ex, x, y, tw, th)) continue;
                        double v = Score(s, x, y, full);
                        if (best == null || v > best.Score) { best = new Hit(); best.X = x; best.Y = y; best.Score = v; }
                    }
            }
            if (best == null) { best = new Hit(); best.Score = 0; }
            return best;
        }
    }

    // ------------------------------------------------------------------ Such- und Aktions-Schleife
    public class Clicker
    {
        public volatile bool Running;
        public volatile string Status = "Bereit.";
        public volatile int Count;
        // Was passieren soll
        public volatile bool DoClick = true, DoKey, KeyHold, Always, Once, Back = true;
        public volatile int Art;          // Klick: 0 links, 1 rechts, 2 doppelt
        public volatile int KeyVk = 0x57; // Taste (Windows-Tastencode), Standard W
        public volatile int HoldMs = 1000; // gedrückt halten; 0 = bis Stopp
        public volatile int IntervalMs = 500, PauseMs = 1000, ThrPct = 90, StartDelayMs;

        readonly object lk = new object();
        Rectangle excl;
        Matcher m;
        Thread th;

        // gerade gehaltene Taste (nur vom Such-Thread benutzt)
        int heldVk = -1;
        long holdEnd, nextRep;
        readonly Stopwatch clock = Stopwatch.StartNew();

        public void SetExcl(Rectangle r) { lock (lk) excl = r; }

        public void Start(Matcher matcher)
        {
            if (Running) return;
            Join(1500);
            m = matcher;
            Count = 0;
            Status = "Startet …";
            Running = true;
            th = new Thread(Loop);
            th.IsBackground = true;
            th.Start();
        }

        public void Stop()
        {
            if (Running) Status = "Angehalten.";
            Running = false;
        }

        public void Join(int ms)
        {
            Thread t = th;
            if (t != null && t.IsAlive) t.Join(ms);
        }

        // Gehaltene Taste: Wiederholung wie bei einer echten Tastatur (nach 0,5 s etwa 30× pro Sekunde)
        void HoldTick()
        {
            if (heldVk < 0) return;
            long t = clock.ElapsedMilliseconds;
            if (t >= holdEnd) { Release(); return; }
            if (t >= nextRep) { Nat.Key(heldVk, true); nextRep = t + 33; }
        }

        void Release()
        {
            if (heldVk < 0) return;
            int vk = heldVk;
            heldVk = -1;
            try { Nat.Key(vk, false); } catch { }
        }

        void Nap(int ms)
        {
            Stopwatch w = Stopwatch.StartNew();
            while (Running && w.ElapsedMilliseconds < ms) { HoldTick(); Thread.Sleep(15); }
        }

        void WaitHold()
        {
            while (Running && heldVk >= 0) { HoldTick(); Thread.Sleep(15); }
        }

        // Führt Klick und/oder Taste aus. Ergebnis: Beschreibung, oder null wenn nichts Neues passiert ist.
        string Act(int x, int y, bool atImage)
        {
            List<string> did = new List<string>();
            if (DoClick)
            {
                if (atImage) Nat.Click(x, y, Art, Back); else Nat.ClickHere(Art);
                did.Add("geklickt");
            }
            int vk = KeyVk;
            if (DoKey && vk > 0)
            {
                string kn = Util.KeyName(vk);
                if (!KeyHold)
                {
                    if (heldVk == vk) Release();
                    Nat.Tap(vk);
                    did.Add(kn + " gedrückt");
                }
                else
                {
                    long t = clock.ElapsedMilliseconds;
                    long end = HoldMs <= 0 ? long.MaxValue : t + HoldMs;
                    if (heldVk != vk)
                    {
                        Release();
                        Nat.Key(vk, true);
                        heldVk = vk; holdEnd = end; nextRep = t + 500;
                        did.Add(kn + " wird gedrückt gehalten" + (HoldMs <= 0 ? " (bis Stopp)" : ""));
                    }
                    else if (end > holdEnd) holdEnd = end;
                }
            }
            return did.Count == 0 ? null : string.Join(" + ", did.ToArray());
        }

        void Loop()
        {
            try
            {
                for (int sec = StartDelayMs / 1000; sec > 0 && Running; sec--)
                {
                    Status = "Startet in " + sec + " … klick jetzt in das Fenster, das den Klick/die Taste bekommen soll!";
                    Nap(1000);
                }
                using (Grabber gr = new Grabber())
                {
                    while (Running)
                    {
                        Stopwatch w = Stopwatch.StartNew();
                        try
                        {
                            if (Always)
                            {
                                string did = Act(0, 0, false);
                                if (did != null) { Count++; Status = "Läuft: " + did + "."; }
                                if (Once) { WaitHold(); if (Running) Status = "Fertig."; Running = false; break; }
                            }
                            else
                            {
                                Pix s = gr.Grab();
                                Rectangle v = gr.Area, ex;
                                lock (lk) ex = excl;
                                if (ex.Width > 0) ex.Offset(-v.Left, -v.Top);
                                Hit h = m.Find(s, ex);
                                HoldTick();
                                if (!Running) break;
                                if (h == null) Status = "Das Bild ist größer als der Bildschirm.";
                                else if (h.Score >= ThrPct / 100.0)
                                {
                                    int x = v.Left + h.X + m.TW / 2, y = v.Top + h.Y + m.TH / 2;
                                    string did = Act(x, y, true);
                                    if (did != null) Count++;
                                    string pc = Util.Pct(h.Score);
                                    if (Once)
                                    {
                                        Status = "Gefunden (" + pc + ")" + (did != null ? " – " + did : "") + ".";
                                        WaitHold();
                                        if (Running) Status = "Gefunden (" + pc + ") – fertig.";
                                        Running = false;
                                        break;
                                    }
                                    Status = "Gefunden (" + pc + ")" + (did != null ? " – " + did : "") + ". Jetzt "
                                        + (PauseMs / 1000.0).ToString("0.#", CultureInfo.GetCultureInfo("de-DE")) + " s Pause.";
                                    Nap(PauseMs);
                                    if (Running) Status = "Sucht …";
                                }
                                else Status = "Sucht … (ähnlichste Stelle bisher: " + Util.Pct(h.Score) + ")";
                            }
                        }
                        catch (Exception e)
                        {
                            Status = "Fehler: " + e.Message;
                            Nap(1000);
                        }
                        int rest = IntervalMs - (int)w.ElapsedMilliseconds;
                        if (rest > 0) Nap(rest);
                    }
                }
            }
            finally { Release(); }
        }
    }

    // ------------------------------------------------------------------ Ausschnitt wählen
    class SnipForm : Form
    {
        readonly Bitmap shot, dim;
        Rectangle hint, sel;
        Point a;
        bool drag;
        readonly Font hf;
        public Bitmap Result;
        const string HintText = "Ziehe mit gedrückter linker Maustaste einen Rahmen um das, worauf geklickt werden soll.\nEsc oder rechte Maustaste = Abbrechen";

        public SnipForm(Bitmap shot, Rectangle v)
        {
            this.shot = shot;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            TopMost = true;
            DoubleBuffered = true;
            KeyPreview = true;
            Cursor = Cursors.Cross;
            BackColor = Color.Black;
            Bounds = v;
            hf = new Font("Segoe UI", 12f, FontStyle.Bold);

            dim = new Bitmap(shot.Width, shot.Height, PixelFormat.Format32bppPArgb);
            using (Graphics g = Graphics.FromImage(dim))
            {
                g.DrawImage(shot, new Rectangle(0, 0, shot.Width, shot.Height), 0, 0, shot.Width, shot.Height, GraphicsUnit.Pixel);
                using (SolidBrush br = new SolidBrush(Color.FromArgb(120, 0, 0, 0))) g.FillRectangle(br, 0, 0, shot.Width, shot.Height);
            }

            Rectangle pr = Screen.PrimaryScreen.Bounds;
            pr.Offset(-v.Left, -v.Top);
            Size ts = TextRenderer.MeasureText(HintText, hf);
            int w = Math.Min(pr.Width - 40, ts.Width + 40), h = ts.Height + 24;
            hint = new Rectangle(pr.Left + (pr.Width - w) / 2, pr.Top + 24, w, h);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            Rectangle cr = Rectangle.Intersect(e.ClipRectangle, new Rectangle(0, 0, dim.Width, dim.Height));
            if (cr.Width > 0 && cr.Height > 0) g.DrawImage(dim, cr, cr, GraphicsUnit.Pixel);
            if (sel.Width > 0 && sel.Height > 0)
            {
                g.DrawImage(shot, sel, sel, GraphicsUnit.Pixel);
                using (Pen p = new Pen(Color.Red, 2)) g.DrawRectangle(p, sel.X - 1, sel.Y - 1, sel.Width + 1, sel.Height + 1);
                TextRenderer.DrawText(g, " " + sel.Width + " × " + sel.Height + " ", Font, new Point(sel.Left, sel.Bottom + 4), Color.White, Color.Black);
            }
            using (SolidBrush br = new SolidBrush(Color.FromArgb(235, 25, 25, 25))) g.FillRectangle(br, hint);
            TextRenderer.DrawText(g, HintText, hf, hint, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.WordBreak);
        }

        static Rectangle Area(Rectangle r)
        {
            if (r.Width <= 0 || r.Height <= 0) return Rectangle.Empty;
            return Rectangle.FromLTRB(r.Left - 6, r.Top - 6, r.Right + 160, r.Bottom + 50);
        }

        void SetSel(Rectangle r)
        {
            Rectangle o = Area(sel), n = Area(r);
            sel = r;
            if (o.IsEmpty && n.IsEmpty) return;
            Invalidate(o.IsEmpty ? n : n.IsEmpty ? o : Rectangle.Union(o, n));
            Invalidate(hint);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            if (e.Button == MouseButtons.Right) { DialogResult = DialogResult.Cancel; return; }
            if (e.Button != MouseButtons.Left) return;
            drag = true;
            a = e.Location;
            SetSel(Rectangle.Empty);
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            if (!drag) return;
            int x1 = Math.Max(0, Math.Min(a.X, e.X)), y1 = Math.Max(0, Math.Min(a.Y, e.Y));
            int x2 = Math.Min(shot.Width, Math.Max(a.X, e.X)), y2 = Math.Min(shot.Height, Math.Max(a.Y, e.Y));
            SetSel(Rectangle.FromLTRB(x1, y1, Math.Max(x1, x2), Math.Max(y1, y2)));
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            if (!drag || e.Button != MouseButtons.Left) return;
            drag = false;
            if (sel.Width >= 6 && sel.Height >= 6)
            {
                Result = Util.Copy32(shot, sel);
                Util.Opaque(Result);
                DialogResult = DialogResult.OK;
            }
            else SetSel(Rectangle.Empty);
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape) DialogResult = DialogResult.Cancel;
            base.OnKeyDown(e);
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) { dim.Dispose(); hf.Dispose(); }
            base.Dispose(disposing);
        }
    }

    // ------------------------------------------------------------------ Rahmen zum Anzeigen eines Treffers
    class MarkForm : Form
    {
        readonly Color col;
        readonly string txt;
        readonly int bw, lh, rw, rh;
        readonly System.Windows.Forms.Timer t;

        public MarkForm(Rectangle r, Color c, string text, float k)
        {
            col = c; txt = text;
            bw = Math.Max(3, (int)(4 * k)); lh = (int)(26 * k); rw = r.Width; rh = r.Height;
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            StartPosition = FormStartPosition.Manual;
            BackColor = Color.Magenta;
            TransparencyKey = Color.Magenta;
            Font = new Font("Segoe UI", 10f, FontStyle.Bold);
            Bounds = new Rectangle(r.Left - bw, r.Top - bw, Math.Max(r.Width + 2 * bw, (int)(70 * k)), r.Height + 2 * bw + lh);
            t = new System.Windows.Forms.Timer();
            t.Interval = 3000;
            t.Tick += delegate { t.Stop(); Close(); };
            t.Start();
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= 0x20 | 0x80 | 0x08000000;   // durchklickbar, nicht in Alt+Tab, nicht aktivieren
                return cp;
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            using (SolidBrush br = new SolidBrush(col))
            {
                g.FillRectangle(br, 0, 0, rw + 2 * bw, bw);
                g.FillRectangle(br, 0, rh + bw, rw + 2 * bw, bw);
                g.FillRectangle(br, 0, 0, bw, rh + 2 * bw);
                g.FillRectangle(br, rw + bw, 0, bw, rh + 2 * bw);
                Size ts = TextRenderer.MeasureText(txt, Font);
                Rectangle lr = new Rectangle(0, rh + 2 * bw, ts.Width + 12, lh);
                g.FillRectangle(br, lr);
                TextRenderer.DrawText(g, txt, Font, lr, Color.Black, col, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing) t.Dispose();
            base.Dispose(disposing);
        }
    }

    // ------------------------------------------------------------------ Hauptfenster
    public class MainForm : Form
    {
        TableLayoutPanel root, colA, colB, cur;
        PictureBox pic;
        Label lblInfo, lblThr, lblStatus, lblCount;
        TrackBar trThr;
        RadioButton rbL, rbR, rbD, rbTap, rbHold, rbWhenImg, rbWhenAlways, rbAlways, rbOnce;
        NumericUpDown nuInt, nuPause, nuHold;
        CheckBox cbClick, cbKey, cbBack, cbTop;
        TextBox txtKey;
        Button btnStart, btnTest, btnSnip, btnOpen, btnPaste;
        readonly System.Windows.Forms.Timer tmr;
        Bitmap tpl;
        Matcher matcher;
        readonly Clicker clk = new Clicker();
        bool f8Prev, f8Ok = true, uiRunning, ready;
        int keyVk = 0x57;
        string lastTitle = "";
        readonly float k = 1f;

        static readonly Color Green = Color.FromArgb(46, 160, 67), Red = Color.FromArgb(200, 55, 45);
        public static readonly string Dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Bildklicker");

        int S(int px) { return (int)Math.Round(px * k); }

        public MainForm()
        {
            using (Graphics g = CreateGraphics()) k = Math.Max(1f, g.DpiX / 96f);
            Text = "Bildklicker";
            Font = new Font("Segoe UI", 10f);
            AutoScaleMode = AutoScaleMode.None;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            AutoSize = true;
            AutoSizeMode = AutoSizeMode.GrowAndShrink;
            StartPosition = FormStartPosition.CenterScreen;
            KeyPreview = true;
            AllowDrop = true;
            try { Icon = SystemIcons.Application; } catch { }

            // zwei Spalten: links Bild + Start, rechts Aktion + Einstellungen
            root = new TableLayoutPanel();
            root.ColumnCount = 2;
            root.RowCount = 1;
            root.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            root.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            root.AutoSize = true;
            root.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            root.Padding = new Padding(S(10), S(2), S(10), S(12));
            root.Location = new Point(0, 0);
            colA = Col(); colB = Col();
            colB.Margin = new Padding(S(24), 0, 0, 0);
            root.Controls.Add(colA, 0, 0);
            root.Controls.Add(colB, 1, 0);

            // ===== linke Spalte
            cur = colA;
            Add(Head("1.  Welches Bild soll es suchen?"));
            pic = new PictureBox();
            pic.Size = new Size(S(420), S(120));
            pic.SizeMode = PictureBoxSizeMode.Zoom;
            pic.BorderStyle = BorderStyle.FixedSingle;
            pic.BackColor = Color.White;
            pic.Margin = new Padding(S(2), S(4), S(2), S(4));
            pic.Paint += PicPaint;
            Add(pic);
            FlowLayoutPanel row = Row();
            btnSnip = Btn("Vom Bildschirm ausschneiden", SnipClick);
            btnSnip.Font = new Font(Font, FontStyle.Bold);
            btnOpen = Btn("Bild öffnen …", OpenClick);
            btnPaste = Btn("Einfügen", PasteClick);
            row.Controls.Add(btnSnip); row.Controls.Add(btnOpen); row.Controls.Add(btnPaste);
            Add(row);
            lblInfo = Lbl("Noch kein Bild. Klicke auf „Vom Bildschirm ausschneiden“.");
            lblInfo.MaximumSize = new Size(S(420), 0);
            Add(lblInfo);

            Add(Head("4.  Los geht's"));
            row = Row();
            btnStart = Btn("START   (F8)", StartClick);
            btnStart.Font = new Font(Font.FontFamily, 13f, FontStyle.Bold);
            btnStart.MinimumSize = new Size(S(210), S(46));
            btnStart.BackColor = Green;
            btnStart.ForeColor = Color.White;
            btnStart.FlatStyle = FlatStyle.Flat;
            btnStart.FlatAppearance.BorderSize = 0;
            row.Controls.Add(btnStart);
            btnTest = Btn("Bild testen (ohne Klick)", TestClick);
            btnTest.MinimumSize = new Size(0, S(46));
            row.Controls.Add(btnTest);
            Add(row);
            lblStatus = Lbl("Bereit.");
            lblStatus.MaximumSize = new Size(S(420), 0);
            lblStatus.Font = new Font(Font, FontStyle.Bold);
            Add(lblStatus);
            lblCount = Lbl("Ausgeführt: 0-mal");
            Add(lblCount);
            Add(Hint("F8 startet und stoppt – auch wenn ein anderes Fenster vorne ist. Tipp: erst ins Spiel klicken, dann F8 drücken."));

            // ===== rechte Spalte
            cur = colB;
            Add(Head("2.  Was soll dann passieren?"));
            row = Row();
            cbClick = Check("Klicken:", true);
            cbClick.Margin = new Padding(S(2), S(5), S(6), S(2));
            row.Controls.Add(cbClick);
            rbL = Radio("Links", true); rbR = Radio("Rechts", false); rbD = Radio("Doppelklick", false);
            row.Controls.Add(rbL); row.Controls.Add(rbR); row.Controls.Add(rbD);
            Add(row);

            row = Row();
            cbKey = Check("Taste drücken:", false);
            cbKey.Margin = new Padding(S(2), S(5), S(6), S(2));
            row.Controls.Add(cbKey);
            txtKey = new TextBox();
            txtKey.ReadOnly = true;
            txtKey.ShortcutsEnabled = false;
            txtKey.Width = S(130);
            txtKey.TextAlign = HorizontalAlignment.Center;
            txtKey.BackColor = Color.White;
            txtKey.Font = new Font(Font, FontStyle.Bold);
            txtKey.Cursor = Cursors.Hand;
            txtKey.Anchor = AnchorStyles.Left;
            txtKey.Text = Util.KeyName(keyVk);
            txtKey.PreviewKeyDown += delegate(object s, PreviewKeyDownEventArgs e) { e.IsInputKey = true; };
            txtKey.KeyDown += KeyBoxDown;
            txtKey.Enter += delegate { txtKey.BackColor = Color.LightYellow; };
            txtKey.Leave += delegate { txtKey.BackColor = Color.White; };
            row.Controls.Add(txtKey);
            Add(row);

            row = Row();
            row.Padding = new Padding(S(22), 0, 0, 0);
            rbTap = Radio("kurz drücken", true);
            rbHold = Radio("gedrückt halten:", false);
            nuHold = Num(0m, 3600m, 1m);
            row.Controls.Add(rbTap); row.Controls.Add(rbHold); row.Controls.Add(nuHold);
            row.Controls.Add(Lbl("Sekunden"));
            Add(row);
            Add(Hint("Ins weiße Feld klicken und die Taste drücken. Halten mit 0 Sekunden = bis du stoppst. Die Taste geht an das Fenster, das gerade vorne ist."));

            Add(Head("3.  Einstellungen"));
            row = Row();
            row.Controls.Add(Lbl("Wann:"));
            rbWhenImg = Radio("Wenn das Bild auftaucht", true);
            rbWhenAlways = Radio("Immer (ohne Bild)", false);
            rbWhenAlways.CheckedChanged += delegate { UpdateEnabled(); };
            row.Controls.Add(rbWhenImg); row.Controls.Add(rbWhenAlways);
            Add(row);

            row = Row();
            row.Controls.Add(Lbl("Wie genau:"));
            trThr = new TrackBar();
            trThr.Minimum = 50; trThr.Maximum = 100; trThr.TickFrequency = 5; trThr.SmallChange = 1; trThr.LargeChange = 5;
            trThr.Value = 90;
            trThr.Width = S(220);
            trThr.ValueChanged += delegate { lblThr.Text = trThr.Value + " %"; Apply(); };
            row.Controls.Add(trThr);
            lblThr = Lbl("90 %");
            lblThr.Font = new Font(Font, FontStyle.Bold);
            row.Controls.Add(lblThr);
            Add(row);
            Add(Hint("Weniger = reagiert auch auf Stellen, die nur ähnlich aussehen. 90 % passt meistens."));

            row = Row();
            row.Controls.Add(Lbl("Wie oft:"));
            rbAlways = Radio("Jedes Mal", true);
            rbOnce = Radio("Nur ein Mal", false);
            row.Controls.Add(rbAlways); row.Controls.Add(rbOnce);
            Add(row);

            row = Row();
            row.Controls.Add(Lbl("Alle"));
            nuInt = Num(0.1m, 600m, 0.5m);
            row.Controls.Add(nuInt);
            row.Controls.Add(Lbl("Sekunden nachschauen"));
            Add(row);

            row = Row();
            row.Controls.Add(Lbl("Danach"));
            nuPause = Num(0m, 600m, 1m);
            row.Controls.Add(nuPause);
            row.Controls.Add(Lbl("Sekunden Pause"));
            Add(row);

            cbBack = Check("Maus nach dem Klick wieder an ihre alte Stelle", true);
            Add(cbBack);
            cbTop = Check("Dieses Fenster immer im Vordergrund", false);
            cbTop.CheckedChanged += delegate { TopMost = cbTop.Checked; };
            Add(cbTop);

            Controls.Add(root);

            tmr = new System.Windows.Forms.Timer();
            tmr.Interval = 40;
            tmr.Tick += Tick;

            KeyDown += delegate(object s, KeyEventArgs e)
            {
                if (ActiveControl == txtKey) return;
                if (e.Control && e.KeyCode == Keys.V) { PasteClick(null, EventArgs.Empty); e.Handled = true; }
            };
            DragEnter += delegate(object s, DragEventArgs e)
            {
                if (e.Data.GetDataPresent(DataFormats.FileDrop) || e.Data.GetDataPresent(DataFormats.Bitmap)) e.Effect = DragDropEffects.Copy;
            };
            DragDrop += OnDropFile;

            LoadSettings();
            ready = true;
            Apply();
            UpdateEnabled();
            try
            {
                string bild = Path.Combine(Dir, "bild.png");
                if (File.Exists(bild)) using (Bitmap b = Util.LoadFile(bild)) SetTemplate(b, false);
            }
            catch { }
        }

        // ---------- kleine Bausteine
        void Add(Control c) { cur.Controls.Add(c); }

        TableLayoutPanel Col()
        {
            TableLayoutPanel t = new TableLayoutPanel();
            t.ColumnCount = 1;
            t.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            t.AutoSize = true;
            t.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            t.Margin = new Padding(0);
            t.Anchor = AnchorStyles.Top | AnchorStyles.Left;
            return t;
        }

        Label Head(string t)
        {
            Label l = Lbl(t);
            l.Font = new Font(Font.FontFamily, 11.5f, FontStyle.Bold);
            l.ForeColor = Color.FromArgb(30, 70, 130);
            l.Margin = new Padding(0, S(cur.Controls.Count == 0 ? 8 : 18), 0, S(2));
            return l;
        }

        FlowLayoutPanel Row()
        {
            FlowLayoutPanel p = new FlowLayoutPanel();
            p.FlowDirection = FlowDirection.LeftToRight;
            p.WrapContents = false;
            p.AutoSize = true;
            p.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            p.Margin = new Padding(0);
            return p;
        }

        Label Lbl(string t)
        {
            Label l = new Label();
            l.Text = t;
            l.AutoSize = true;
            l.Anchor = AnchorStyles.Left;
            l.Margin = new Padding(S(2), S(4), S(4), S(4));
            return l;
        }

        Label Hint(string t)
        {
            Label l = Lbl(t);
            l.ForeColor = Color.DimGray;
            l.Font = new Font(Font.FontFamily, 9f);
            l.MaximumSize = new Size(S(420), 0);
            return l;
        }

        Button Btn(string t, EventHandler h)
        {
            Button b = new Button();
            b.Text = t;
            b.AutoSize = true;
            b.AutoSizeMode = AutoSizeMode.GrowAndShrink;
            b.Padding = new Padding(S(6), S(3), S(6), S(3));
            b.Margin = new Padding(S(2), S(4), S(6), S(4));
            b.UseVisualStyleBackColor = true;
            b.Click += h;
            return b;
        }

        RadioButton Radio(string t, bool on)
        {
            RadioButton r = new RadioButton();
            r.Text = t;
            r.AutoSize = true;
            r.Checked = on;
            r.Anchor = AnchorStyles.Left;
            r.CheckedChanged += delegate { Apply(); };
            return r;
        }

        CheckBox Check(string t, bool on)
        {
            CheckBox c = new CheckBox();
            c.Text = t;
            c.AutoSize = true;
            c.Checked = on;
            c.Anchor = AnchorStyles.Left;
            c.Margin = new Padding(S(2), S(4), S(2), S(2));
            c.CheckedChanged += delegate { Apply(); };
            return c;
        }

        NumericUpDown Num(decimal min, decimal max, decimal val)
        {
            NumericUpDown n = new NumericUpDown();
            n.Minimum = min; n.Maximum = max; n.DecimalPlaces = 1; n.Increment = 0.1m; n.Value = val;
            n.Width = S(70);
            n.Anchor = AnchorStyles.Left;
            n.ValueChanged += delegate { Apply(); };
            return n;
        }

        static decimal Clamp(NumericUpDown n, decimal v) { return Math.Max(n.Minimum, Math.Min(n.Maximum, v)); }

        void Msg(string t) { MessageBox.Show(this, t, "Bildklicker", MessageBoxButtons.OK, MessageBoxIcon.Information); }

        // ---------- Taste wählen
        void KeyBoxDown(object sender, KeyEventArgs e)
        {
            e.Handled = true;
            e.SuppressKeyPress = true;
            int vk = (int)e.KeyCode;
            if (vk == 0x77) return;   // F8 = Start/Stopp, nicht als Taste
            if (vk == 0) return;
            keyVk = vk;
            txtKey.Text = Util.KeyName(vk);
            cbKey.Checked = true;
            Apply();
        }

        // ---------- Einstellungen
        void Apply()
        {
            if (!ready) return;
            clk.ThrPct = trThr.Value;
            clk.DoClick = cbClick.Checked;
            clk.Art = rbR.Checked ? 1 : rbD.Checked ? 2 : 0;
            clk.DoKey = cbKey.Checked;
            clk.KeyVk = keyVk;
            clk.KeyHold = rbHold.Checked;
            clk.HoldMs = (int)(nuHold.Value * 1000m);
            clk.Always = rbWhenAlways.Checked;
            clk.Once = rbOnce.Checked;
            clk.IntervalMs = (int)(nuInt.Value * 1000m);
            clk.PauseMs = (int)(nuPause.Value * 1000m);
            clk.Back = cbBack.Checked;
        }

        void UpdateEnabled()
        {
            bool img = !rbWhenAlways.Checked;
            trThr.Enabled = img;
            cbBack.Enabled = img;
        }

        void LoadSettings()
        {
            try
            {
                string f = Path.Combine(Dir, "einstellungen.txt");
                if (!File.Exists(f)) return;
                CultureInfo ci = CultureInfo.InvariantCulture;
                foreach (string line in File.ReadAllLines(f))
                {
                    int i = line.IndexOf('=');
                    if (i < 0) continue;
                    string key = line.Substring(0, i).Trim(), v = line.Substring(i + 1).Trim();
                    try
                    {
                        if (key == "genau") trThr.Value = Math.Max(50, Math.Min(100, int.Parse(v, ci)));
                        else if (key == "klicken") cbClick.Checked = v == "1";
                        else if (key == "klick") { int a = int.Parse(v, ci); rbR.Checked = a == 1; rbD.Checked = a == 2; rbL.Checked = a != 1 && a != 2; }
                        else if (key == "taste_an") cbKey.Checked = v == "1";
                        else if (key == "taste") { int t = int.Parse(v, ci); if (t > 0 && t < 256 && t != 0x77) { keyVk = t; txtKey.Text = Util.KeyName(t); } }
                        else if (key == "halten") { rbHold.Checked = v == "1"; rbTap.Checked = v != "1"; }
                        else if (key == "haltezeit") nuHold.Value = Clamp(nuHold, decimal.Parse(v, ci));
                        else if (key == "immer") { rbWhenAlways.Checked = v == "1"; rbWhenImg.Checked = v != "1"; }
                        else if (key == "einmal") { rbOnce.Checked = v == "1"; rbAlways.Checked = v != "1"; }
                        else if (key == "alle") nuInt.Value = Clamp(nuInt, decimal.Parse(v, ci));
                        else if (key == "pause") nuPause.Value = Clamp(nuPause, decimal.Parse(v, ci));
                        else if (key == "zurueck") cbBack.Checked = v == "1";
                        else if (key == "oben") cbTop.Checked = v == "1";
                    }
                    catch { }
                }
            }
            catch { }
        }

        void SaveSettings()
        {
            try
            {
                Directory.CreateDirectory(Dir);
                CultureInfo ci = CultureInfo.InvariantCulture;
                string[] lines = {
                    "genau=" + trThr.Value.ToString(ci),
                    "klicken=" + (cbClick.Checked ? "1" : "0"),
                    "klick=" + (rbR.Checked ? 1 : rbD.Checked ? 2 : 0).ToString(ci),
                    "taste_an=" + (cbKey.Checked ? "1" : "0"),
                    "taste=" + keyVk.ToString(ci),
                    "halten=" + (rbHold.Checked ? "1" : "0"),
                    "haltezeit=" + nuHold.Value.ToString(ci),
                    "immer=" + (rbWhenAlways.Checked ? "1" : "0"),
                    "einmal=" + (rbOnce.Checked ? "1" : "0"),
                    "alle=" + nuInt.Value.ToString(ci),
                    "pause=" + nuPause.Value.ToString(ci),
                    "zurueck=" + (cbBack.Checked ? "1" : "0"),
                    "oben=" + (cbTop.Checked ? "1" : "0")
                };
                File.WriteAllLines(Path.Combine(Dir, "einstellungen.txt"), lines);
            }
            catch { }
        }

        // ---------- Bild setzen
        void SetTemplate(Bitmap b, bool save)
        {
            if (b.Width < 6 || b.Height < 6) { Msg("Das Bild ist zu klein (mindestens 6 × 6 Pixel)."); return; }
            if (clk.Running) StopRun();
            Bitmap old = tpl;
            tpl = Util.Copy32(b, new Rectangle(0, 0, b.Width, b.Height));
            pic.Image = tpl;
            if (old != null) old.Dispose();
            matcher = new Matcher(Pix.Of(tpl));
            lblInfo.Text = "Bild: " + tpl.Width + " × " + tpl.Height + " Pixel. Jetzt am besten „Bild testen“ drücken.";
            lblStatus.Text = "Bereit.";
            if (save)
            {
                try { Directory.CreateDirectory(Dir); tpl.Save(Path.Combine(Dir, "bild.png"), ImageFormat.Png); } catch { }
            }
        }

        void PicPaint(object sender, PaintEventArgs e)
        {
            if (pic.Image != null) return;
            TextRenderer.DrawText(e.Graphics, "(noch kein Bild)", Font, pic.ClientRectangle, Color.Gray,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }

        void SnipClick(object sender, EventArgs e)
        {
            if (clk.Running) StopRun();
            Bitmap shot = null;
            Hide();
            try
            {
                Application.DoEvents();
                Thread.Sleep(350);
                Rectangle v = SystemInformation.VirtualScreen;
                shot = Grabber.Shot(v);
                using (SnipForm sf = new SnipForm(shot, v))
                {
                    if (sf.ShowDialog() == DialogResult.OK && sf.Result != null)
                    {
                        using (Bitmap r = sf.Result) SetTemplate(r, true);
                    }
                }
            }
            catch (Exception ex) { Msg("Ausschneiden hat nicht geklappt: " + ex.Message); }
            finally
            {
                if (shot != null) shot.Dispose();
                Show();
                Activate();
            }
        }

        void OpenClick(object sender, EventArgs e)
        {
            using (OpenFileDialog d = new OpenFileDialog())
            {
                d.Title = "Bild auswählen";
                d.Filter = "Bilder|*.png;*.jpg;*.jpeg;*.bmp;*.gif|Alle Dateien|*.*";
                if (d.ShowDialog(this) != DialogResult.OK) return;
                LoadPath(d.FileName);
            }
        }

        void LoadPath(string path)
        {
            try { using (Bitmap b = Util.LoadFile(path)) SetTemplate(b, true); }
            catch (Exception ex) { Msg("Das Bild konnte nicht geöffnet werden:\n" + ex.Message); }
        }

        void PasteClick(object sender, EventArgs e)
        {
            try
            {
                if (Clipboard.ContainsImage())
                {
                    using (Image img = Clipboard.GetImage())
                    using (Bitmap b = Util.Copy32(img)) SetTemplate(b, true);
                    return;
                }
                if (Clipboard.ContainsFileDropList() && Clipboard.GetFileDropList().Count > 0)
                {
                    LoadPath(Clipboard.GetFileDropList()[0]);
                    return;
                }
                Msg("In der Zwischenablage ist kein Bild.\n\nSo geht's: Windows-Taste + Umschalt + S drücken, einen Rahmen ziehen – dann hier auf „Einfügen“ klicken.");
            }
            catch (Exception ex) { Msg("Einfügen hat nicht geklappt: " + ex.Message); }
        }

        void OnDropFile(object sender, DragEventArgs e)
        {
            try
            {
                string[] files = e.Data.GetData(DataFormats.FileDrop) as string[];
                if (files != null && files.Length > 0) { LoadPath(files[0]); return; }
                Image img = e.Data.GetData(DataFormats.Bitmap) as Image;
                if (img != null) using (Bitmap b = Util.Copy32(img)) SetTemplate(b, true);
            }
            catch (Exception ex) { Msg("Das Bild konnte nicht übernommen werden: " + ex.Message); }
        }

        // ---------- Start / Stopp / Test
        void StartClick(object sender, EventArgs e)
        {
            if (clk.Running) StopRun(); else StartRun(true);
        }

        void Toggle()
        {
            if (clk.Running) StopRun(); else StartRun(false);
        }

        void StartRun(bool viaButton)
        {
            Apply();
            bool always = rbWhenAlways.Checked;
            if (!cbClick.Checked && !cbKey.Checked)
            {
                Activate();
                Msg("Bitte bei „2. Was soll dann passieren?“ ankreuzen: „Klicken“ und/oder „Taste drücken“.");
                return;
            }
            if (!always && matcher == null)
            {
                Activate();
                Msg("Bitte zuerst ein Bild wählen (Schritt 1).\n\nOder bei „Wann“ auf „Immer (ohne Bild)“ stellen.");
                return;
            }
            // Mit dem Knopf gestartet: 3 Sekunden Zeit, um ins richtige Fenster zu klicken
            clk.StartDelayMs = viaButton && (always || cbKey.Checked) ? 3000 : 0;
            UpdateExcl();
            ActiveControl = null;   // damit z. B. die Leertaste nicht den Stopp-Knopf drückt
            clk.Start(matcher);
            uiRunning = true;
            btnStart.Text = "STOPP   (F8)";
            btnStart.BackColor = Red;
            SetTools(false);
        }

        void StopRun()
        {
            clk.Stop();
            UiStopped();
        }

        void UiStopped()
        {
            uiRunning = false;
            btnStart.Text = "START   (F8)";
            btnStart.BackColor = Green;
            SetTools(true);
            lblStatus.Text = clk.Status;
            lblCount.Text = "Ausgeführt: " + clk.Count + "-mal";
        }

        void SetTools(bool on)
        {
            btnTest.Enabled = on; btnSnip.Enabled = on; btnOpen.Enabled = on; btnPaste.Enabled = on;
            rbWhenImg.Enabled = on; rbWhenAlways.Enabled = on; txtKey.Enabled = on;
        }

        void UpdateExcl()
        {
            clk.SetExcl(Visible && WindowState != FormWindowState.Minimized ? Bounds : Rectangle.Empty);
        }

        void TestClick(object sender, EventArgs e)
        {
            if (matcher == null) { Msg("Bitte zuerst ein Bild wählen (Schritt 1)."); return; }
            Cursor = Cursors.WaitCursor;
            try
            {
                using (Grabber gr = new Grabber())
                {
                    Pix p = gr.Grab();
                    Rectangle v = gr.Area, ex = Bounds;
                    ex.Offset(-v.Left, -v.Top);
                    Hit h = matcher.Find(p, ex);
                    if (h == null) { lblStatus.Text = "Das Bild ist größer als der Bildschirm."; return; }
                    bool ok = h.Score >= trThr.Value / 100.0;
                    string pc = Util.Pct(h.Score);
                    lblStatus.Text = ok
                        ? "Gefunden! Übereinstimmung " + pc + ". Dort würde geklickt (grüner Rahmen)."
                        : "Nicht gefunden. Die ähnlichste Stelle (oranger Rahmen) passt nur zu " + pc + ".";
                    if (h.Score > 0)
                    {
                        Rectangle r = new Rectangle(v.Left + h.X, v.Top + h.Y, matcher.TW, matcher.TH);
                        new MarkForm(r, ok ? Color.LimeGreen : Color.Orange, pc, k).Show();
                    }
                }
            }
            catch (Exception ex) { Msg("Test hat nicht geklappt: " + ex.Message); }
            finally { Cursor = Cursors.Default; }
        }

        void Tick(object sender, EventArgs e)
        {
            if (f8Ok)
            {
                try
                {
                    bool down = (Nat.GetAsyncKeyState(0x77) & 0x8000) != 0;
                    if (down && !f8Prev) Toggle();
                    f8Prev = down;
                }
                catch { f8Ok = false; }
            }
            UpdateExcl();
            if (uiRunning)
            {
                lblStatus.Text = clk.Status;
                lblCount.Text = "Ausgeführt: " + clk.Count + "-mal";
                if (!clk.Running) UiStopped();
            }
            string title = clk.Running ? "Bildklicker – läuft (" + clk.Count + "-mal)" : "Bildklicker";
            if (title != lastTitle) { Text = title; lastTitle = title; }
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            tmr.Start();
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            tmr.Stop();
            clk.Stop();
            clk.Join(2000);   // gehaltene Taste sicher loslassen
            SaveSettings();
            base.OnFormClosing(e);
        }
    }

    // ------------------------------------------------------------------ Start
    public static class Program
    {
        public static void Start()
        {
            Nat.DpiAware();
            Nat.HideConsole();
            try { Application.EnableVisualStyles(); } catch { }
            try { Application.SetCompatibleTextRenderingDefault(false); } catch { }
            try { Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException); } catch { }
            Application.ThreadException += delegate(object s, ThreadExceptionEventArgs e)
            {
                MessageBox.Show("Es ist ein Fehler aufgetreten:\n\n" + e.Exception.Message, "Bildklicker", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            };
            Application.Run(new MainForm());
        }

        [STAThread]
        public static void Main() { Start(); }
    }
}
