// Test der Bildsuche (läuft unter Linux mit Mono, ohne Windows-Fenster).
// Aufruf: bash bildklicker/test/test.sh
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using Bildklicker;

public static class TestMain
{
    static int fails = 0, checks = 0;
    static Matcher lastM; static Pix lastS;

    static string Parts(Hit h)
    {
        double ncc, col;
        lastM.ScoreParts(lastS, h.X, h.Y, out ncc, out col);
        return string.Format("[{0}: Form {1:0.000}, Farbe {2:0.000}]", lastM.LastWay, ncc, col);
    }
    static string dir;

    static void Check(bool ok, string what)
    {
        checks++;
        if (!ok) fails++;
        Console.WriteLine((ok ? "  ok    " : "  FEHLER ") + what);
    }

    static Bitmap Load(string name) { return Util.LoadFile(Path.Combine(dir, name)); }

    static Dictionary<string, Rectangle> Boxes(string v)
    {
        var d = new Dictionary<string, Rectangle>();
        foreach (string line in File.ReadAllLines(Path.Combine(dir, "boxen_" + v + ".txt")))
        {
            string[] p = line.Split(' ');
            if (p.Length < 5) continue;
            d[p[0]] = new Rectangle(int.Parse(p[1]), int.Parse(p[2]), int.Parse(p[3]), int.Parse(p[4]));
        }
        return d;
    }

    static Hit Find(Bitmap screen, Bitmap tpl, Rectangle ex, out long ms)
    {
        Pix s = Pix.Of(screen);
        Matcher m = new Matcher(Pix.Of(tpl));
        m.Find(s, ex); // erster Lauf (JIT)
        Stopwatch w = Stopwatch.StartNew();
        Hit h = m.Find(s, ex);
        ms = w.ElapsedMilliseconds;
        lastM = m; lastS = s;
        return h;
    }

    static Hit Find(Bitmap screen, Bitmap tpl) { long ms; return Find(screen, tpl, Rectangle.Empty, out ms); }

    static Bitmap Jpeg(Bitmap b, long q)
    {
        ImageCodecInfo codec = null;
        foreach (ImageCodecInfo c in ImageCodecInfo.GetImageEncoders()) if (c.MimeType == "image/jpeg") codec = c;
        EncoderParameters ps = new EncoderParameters(1);
        ps.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, q);
        MemoryStream ms = new MemoryStream();
        b.Save(ms, codec, ps);
        ms.Position = 0;
        using (Image img = Image.FromStream(ms)) return Util.Copy32(img);
    }

    static double GrayStd(Bitmap b)
    {
        Pix p = Pix.Of(b);
        double s = 0, s2 = 0;
        foreach (int g in p.G) { s += g; s2 += (double)g * g; }
        double n = p.G.Length, m = s / n;
        return Math.Sqrt(Math.Max(0, s2 / n - m * m));
    }

    static bool SamePixels(Bitmap screen, Bitmap tpl, int x, int y)
    {
        Pix s = Pix.Of(screen), t = Pix.Of(tpl);
        for (int j = 0; j < t.H; j++)
            for (int i = 0; i < t.W; i++)
            {
                int a = ((y + j) * s.W + x + i) * 4, b = (j * t.W + i) * 4;
                if (s.B[a] != t.B[b] || s.B[a + 1] != t.B[b + 1] || s.B[a + 2] != t.B[b + 2]) return false;
            }
        return true;
    }

    public static int Main(string[] args)
    {
        dir = args.Length > 0 ? args[0] : "bk_bilder";
        double thr = 0.90;
        int perSize = args.Length > 1 ? int.Parse(args[1]) : 8;
        Bitmap A = Load("seite_A.png"), B = Load("seite_B.png"), C = Load("seite_C.png");
        var bA = Boxes("A"); var bB = Boxes("B"); var bC = Boxes("C");

        Console.WriteLine("1) Zufällige Ausschnitte im selben Bild wiederfinden");
        Random rnd = new Random(7);
        int[][] sizes = { new[] { 8, 8 }, new[] { 12, 10 }, new[] { 20, 16 }, new[] { 40, 30 }, new[] { 64, 64 }, new[] { 120, 40 }, new[] { 300, 200 } };
        long tmax = 0;
        foreach (int[] sz in sizes)
        {
            int good = 0, tries = 0; long tsum = 0; double minScore = 1;
            while (tries < perSize)
            {
                int x = rnd.Next(A.Width - sz[0]), y = rnd.Next(A.Height - sz[1]);
                Rectangle r = new Rectangle(x, y, sz[0], sz[1]);
                using (Bitmap t = Util.Copy32(A, r))
                {
                    if (GrayStd(t) < 12) continue;   // einfarbige Stellen gibt es mehrfach – überspringen
                    tries++;
                    long ms;
                    Hit h = Find(A, t, Rectangle.Empty, out ms);
                    tsum += ms; tmax = Math.Max(tmax, ms);
                    bool ok = h != null && h.Score >= 0.999 && ((h.X == x && h.Y == y) || SamePixels(A, t, h.X, h.Y));
                    if (ok) good++;
                    else Console.WriteLine("     daneben: " + r + " -> " + (h == null ? "null" : h.X + "," + h.Y + " " + h.Score.ToString("0.000") + " " + Parts(h)));
                    if (h != null) minScore = Math.Min(minScore, h.Score);
                }
            }
            Check(good == tries, string.Format("{0}×{1}: {2}/{3} gefunden, kleinste Übereinstimmung {4:0.000}, Ø {5} ms", sz[0], sz[1], good, tries, minScore, tsum / tries));
        }
        Check(tmax < 1500, "Langsamste Suche " + tmax + " ms (1920×1080)");

        Console.WriteLine("2) Knopf an anderer Stelle / mit Hover-Farbe / fehlt");
        using (Bitmap ok = Util.Copy32(A, bA["OK"]))
        {
            Hit h = Find(B, ok);
            Console.WriteLine("     OK (Hover-Farbe) in B: " + h.X + "," + h.Y + " Übereinstimmung " + h.Score.ToString("0.000") + " " + Parts(h));
            Check(Math.Abs(h.X - bB["OK"].X) <= 1 && Math.Abs(h.Y - bB["OK"].Y) <= 1, "OK-Knopf (Hover) in B an der richtigen Stelle als beste Stelle");
            Hit h2 = Find(C, ok);
            Check(h2.Score < thr, "OK fehlt in C -> nicht gefunden (beste Stelle " + h2.Score.ToString("0.000") + " bei " + h2.X + "," + h2.Y + ")");
        }
        using (Bitmap ab = Util.Copy32(A, bA["Abbrechen"]))
        {
            Hit h = Find(C, ab);
            Check(h.X == bC["Abbrechen"].X && h.Y == bC["Abbrechen"].Y && h.Score > 0.99, "Abbrechen in C gefunden (" + h.Score.ToString("0.000") + ")");
            long ms;
            Rectangle ex = Rectangle.Inflate(bC["Abbrechen"], 10, 10);
            Hit h2 = Find(C, ab, ex, out ms);
            Check(h2.Score < thr && !ex.IntersectsWith(new Rectangle(h2.X, h2.Y, ab.Width, ab.Height)),
                "Ausgeschlossener Bereich wird nicht durchsucht (beste andere Stelle " + h2.Score.ToString("0.000") + ")");
        }
        using (Bitmap we = Util.Copy32(A, bA["Weiter"]))
        using (Bitmap ab = Util.Copy32(A, bA["Abbrechen"]))
        {
            // nur der Rahmen eines Knopfes, Text anders: darf nicht als „Weiter“ gelten
            Rectangle r = bA["Weiter"];
            using (Bitmap c2 = (Bitmap)C.Clone())
            {
                using (Graphics g = Graphics.FromImage(c2)) g.FillRectangle(new SolidBrush(Color.FromArgb(243, 243, 243)), r);
                Hit h = Find(c2, we);
                Check(h.Score < thr, "Weiter entfernt -> Abbrechen-Knopf zählt nicht als Weiter (beste Stelle " + h.Score.ToString("0.000") + ")");
            }
        }

        Console.WriteLine("3) Vorlage als JPG (Qualität 60) / Münze auf anderem Hintergrund");
        using (Bitmap ok = Util.Copy32(A, bA["OK"]))
        using (Bitmap j = Jpeg(ok, 60))
        {
            Hit h = Find(A, j);
            Check(h.X == bA["OK"].X && h.Y == bA["OK"].Y && h.Score >= thr, "OK als JPG gefunden (" + h.Score.ToString("0.000") + " bei " + h.X + "," + h.Y + ")");
        }
        using (Bitmap coin = Util.Copy32(A, bA["coin3"]))
        {
            Hit h = Find(B, coin);
            Console.WriteLine("     Münze in B: " + h.X + "," + h.Y + " Übereinstimmung " + h.Score.ToString("0.000") + " " + Parts(h));
            Check(Math.Abs(h.X - bB["coin3"].X) <= 1 && Math.Abs(h.Y - bB["coin3"].Y) <= 1, "Münze auf anderem Hintergrund an der richtigen Stelle als beste Stelle");
        }
        // Münze ohne Ecken (nur Inneres)
        using (Bitmap coin = Util.Copy32(A, Rectangle.Inflate(bA["coin3"], -9, -9)))
        {
            Hit h = Find(B, coin);
            Check(Math.Abs(h.X - bB["coin3"].X - 9) <= 1 && Math.Abs(h.Y - bB["coin3"].Y - 9) <= 1 && h.Score >= thr,
                "Münze (nur Inneres) auf anderem Hintergrund gefunden (" + h.Score.ToString("0.000") + ")");
        }

        Console.WriteLine("4) Ähnliche Symbole mit anderer Farbe / anderer Form");
        // Symbol 0 (roter Stern) und Symbol 8 (oranger Stern), Symbol 1 (Herz)
        Rectangle i0 = new Rectangle(60, 150, 52, 52);
        using (Bitmap star = Util.Copy32(A, i0))
        {
            Hit h = Find(A, star);
            Check(h.X == 60 && h.Y == 150 && h.Score > 0.99, "Roter Stern gefunden (" + h.X + "," + h.Y + " " + h.Score.ToString("0.000") + ")");
            using (Bitmap a2 = (Bitmap)A.Clone())
            {
                using (Graphics g = Graphics.FromImage(a2)) g.FillRectangle(new SolidBrush(Color.FromArgb(243, 243, 243)), i0);
                Hit h2 = Find(a2, star);
                Console.WriteLine("     ohne roten Stern: beste Stelle " + h2.X + "," + h2.Y + " " + h2.Score.ToString("0.000") + " " + Parts(h2));
                Check(h2.Score < thr, "Oranger Stern zählt nicht als roter Stern (" + h2.Score.ToString("0.000") + ")");
            }
        }

        Console.WriteLine("5) Zwei Bildschirme nebeneinander (3840×1080) und 4K (3840×2160)");
        using (Bitmap two = new Bitmap(3840, 1080, PixelFormat.Format32bppArgb))
        using (Bitmap k4 = new Bitmap(3840, 2160, PixelFormat.Format32bppArgb))
        {
            using (Graphics g = Graphics.FromImage(two))
            {
                g.DrawImage(C, new Rectangle(0, 0, 1920, 1080), 0, 0, 1920, 1080, GraphicsUnit.Pixel);
                g.DrawImage(A, new Rectangle(1920, 0, 1920, 1080), 0, 0, 1920, 1080, GraphicsUnit.Pixel);
            }
            using (Graphics g = Graphics.FromImage(k4))
            {
                g.DrawImage(C, new Rectangle(0, 0, 1920, 1080), 0, 0, 1920, 1080, GraphicsUnit.Pixel);
                g.DrawImage(B, new Rectangle(1920, 0, 1920, 1080), 0, 0, 1920, 1080, GraphicsUnit.Pixel);
                g.DrawImage(C, new Rectangle(0, 1080, 1920, 1080), 0, 0, 1920, 1080, GraphicsUnit.Pixel);
                g.DrawImage(A, new Rectangle(1920, 1080, 1920, 1080), 0, 0, 1920, 1080, GraphicsUnit.Pixel);
            }
            Rectangle okr = bA["OK"];
            foreach (Rectangle tr in new[] { new Rectangle(okr.X + 28, okr.Y + 12, 10, 10), okr, new Rectangle(okr.X, okr.Y, 400, 300) })
            {
                int[] sz = { tr.Width, tr.Height };
                using (Bitmap t = Util.Copy32(A, tr))
                {
                    long ms, ms2;
                    Hit h = Find(two, t, Rectangle.Empty, out ms);
                    Hit h2 = Find(k4, t, Rectangle.Empty, out ms2);
                    Check(h.X == 1920 + tr.X && h.Y == tr.Y && h.Score > 0.99
                        && h2.X == 1920 + tr.X && h2.Y == 1080 + tr.Y && h2.Score > 0.99,
                        string.Format("{0}×{1}: gefunden, {2} ms (2 Bildschirme) / {3} ms (4K)", sz[0], sz[1], ms, ms2));
                }
            }
        }

        Console.WriteLine();
        Console.WriteLine(fails == 0 ? ("Alle " + checks + " Prüfungen bestanden.") : (fails + " von " + checks + " Prüfungen FEHLGESCHLAGEN."));
        return fails == 0 ? 0 : 1;
    }
}
