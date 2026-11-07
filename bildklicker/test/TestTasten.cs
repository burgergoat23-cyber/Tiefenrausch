// Test des Tasten-Drückers (ohne Windows: Tastendrücke werden aufgezeichnet).
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using Bildklicker;

public static class TestTasten
{
    static int fails = 0, checks = 0;
    static readonly List<string> log = new List<string>();
    static readonly Stopwatch clock = Stopwatch.StartNew();

    static void Check(bool ok, string what)
    {
        checks++;
        if (!ok) fails++;
        Console.WriteLine((ok ? "  ok    " : "  FEHLER ") + what);
    }

    static void Rec(int vk, bool down) { lock (log) log.Add(clock.ElapsedMilliseconds + " " + Util.KeyName(vk) + (down ? " runter" : " hoch")); }

    static List<string> Events() { lock (log) return new List<string>(log); }

    static int CountOf(List<string> ev, string what) { int n = 0; foreach (string e in ev) if (e.EndsWith(" " + what)) n++; return n; }

    static void WaitDone(KeyRunner r, int maxMs)
    {
        Stopwatch w = Stopwatch.StartNew();
        while (r.Running && w.ElapsedMilliseconds < maxMs) Thread.Sleep(10);
    }

    public static int Main()
    {
        Nat.TestHook = Rec;

        Console.WriteLine("1) Ablauf 3-mal: W kurz, 0,3 s warten, Leertaste 0,2 s halten");
        var steps = new List<KeyStep> { new KeyStep(0, 0x57, 0), new KeyStep(2, 0, 300), new KeyStep(1, 0x20, 200) };
        KeyRunner r = new KeyRunner();
        r.Repeat = 3;
        log.Clear();
        long t0 = clock.ElapsedMilliseconds;
        r.Start(steps);
        WaitDone(r, 5000);
        long dt = clock.ElapsedMilliseconds - t0;
        var ev = Events();
        Check(!r.Running && r.Rounds == 3, "nach 3 Durchgängen von selbst fertig (" + r.Status + ")");
        Check(CountOf(ev, "W runter") == 3 && CountOf(ev, "W hoch") == 3, "W 3× gedrückt und losgelassen");
        Check(CountOf(ev, "Leertaste runter") == 3 && CountOf(ev, "Leertaste hoch") == 3, "Leertaste 3× gehalten und losgelassen (kurz: keine Wiederholung)");
        Check(dt >= 3 * (300 + 200) && dt < 3000, "Dauer passt: " + dt + " ms (erwartet etwa 1650)");
        Check(ev.Count > 0 && ev[0].EndsWith("W runter"), "Reihenfolge beginnt mit W");

        Console.WriteLine("2) W gedrückt halten bis Stopp, nach 1,2 s stoppen");
        log.Clear();
        r = new KeyRunner();
        r.Start(new List<KeyStep> { new KeyStep(1, 0x57, 0) });
        Thread.Sleep(1200);
        Check(r.Running, "läuft noch (hält fest)");
        ev = Events();
        int downs = CountOf(ev, "W runter");
        Check(downs >= 15 && CountOf(ev, "W hoch") == 0, "W festgehalten, mit Tastenwiederholung wie echt (" + downs + "× runter, noch nicht hoch)");
        r.Stop();
        r.Join(1000);
        ev = Events();
        Check(!r.Running && CountOf(ev, "W hoch") == 1 && ev[ev.Count - 1].EndsWith("W hoch"), "nach Stopp wird W losgelassen");

        Console.WriteLine("3) Stopp mitten im Halten von 5 s");
        log.Clear();
        r = new KeyRunner();
        r.Repeat = 0;
        r.Start(new List<KeyStep> { new KeyStep(1, 0x41, 5000), new KeyStep(0, 0x42, 0) });
        Thread.Sleep(300);
        r.Stop();
        r.Join(1000);
        ev = Events();
        Check(CountOf(ev, "A runter") == 1 && CountOf(ev, "A hoch") == 1 && CountOf(ev, "B runter") == 0, "A losgelassen, B nicht mehr gedrückt");

        Console.WriteLine("4) Start mit 3 s Vorlauf (über den Knopf)");
        log.Clear();
        r = new KeyRunner();
        r.Repeat = 1;
        r.StartDelayMs = 3000;
        t0 = clock.ElapsedMilliseconds;
        r.Start(new List<KeyStep> { new KeyStep(0, 0x57, 0) });
        Thread.Sleep(500);
        Check(Events().Count == 0 && r.Status.StartsWith("Startet in"), "während des Vorlaufs noch keine Taste (" + r.Status + ")");
        WaitDone(r, 5000);
        ev = Events();
        long first = ev.Count > 0 ? long.Parse(ev[0].Split(' ')[0]) - t0 : -1;
        Check(first >= 2900, "erste Taste nach " + first + " ms");

        Console.WriteLine("5) Speichern und Laden des Ablaufs");
        var orig = new List<KeyStep> { new KeyStep(0, 0x57, 0), new KeyStep(1, 0x20, 2500), new KeyStep(2, 0, 1000), new KeyStep(1, 0x10, 0) };
        bool same = true;
        foreach (KeyStep st in orig)
        {
            KeyStep b = KeyStep.Parse(st.Save());
            if (b == null || b.Kind != st.Kind || b.Vk != st.Vk || b.Ms != st.Ms) same = false;
        }
        Check(same, "Schritte bleiben beim Speichern gleich");
        Check(KeyStep.Parse("x") == null && KeyStep.Parse("1:0:500") == null && KeyStep.Parse("5:87:0") == null, "kaputte Einträge werden ignoriert");
        Console.WriteLine("     Anzeige: " + string.Join(" | ", new[] { orig[0].ToString(), orig[1].ToString(), orig[2].ToString(), orig[3].ToString() }));

        Console.WriteLine();
        Console.WriteLine(fails == 0 ? ("Alle " + checks + " Prüfungen bestanden.") : (fails + " von " + checks + " Prüfungen FEHLGESCHLAGEN."));
        return fails == 0 ? 0 : 1;
    }
}
