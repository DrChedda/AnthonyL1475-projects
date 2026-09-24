using HarmonyLib;
using System;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using xiaoye97;

namespace SharpChedda
{
    [BepInDependency("me.xiaoye97.plugin.Dyson.LDBTool", BepInDependency.DependencyFlags.HardDependency)]
    [BepInPlugin("sebdalf.dsp.betterlogisticsstation", "DSP Better Logistics Station", "1.0.0")]
    [BepInProcess("DSPGAME.exe")]
    public class BetterLogisticsStation : BaseUnityPlugin
    {
        private Harmony _harmony;
        internal static ManualLogSource logger;

        public static ConfigEntry<int> PlanetaryLogisticsStationMaxItemKinds;
        public static ConfigEntry<int> PlanetaryLogisticsStationMaxItemCount;
        public static ConfigEntry<int> InterstellarLogisticsStationMaxItemKinds;
        public static ConfigEntry<int> InterstellarLogisticsStationMaxItemCount;

        private void Awake()
        {
            BetterLogisticsStation.logger = base.Logger;
            PlanetaryLogisticsStationMaxItemKinds = Config.Bind("PlanetaryStation", "MaxItemKinds", 6, "Number of slots for PLS (Max 6)");
            PlanetaryLogisticsStationMaxItemCount = Config.Bind("PlanetaryStation", "MaxItemCount", 5000, "Capacity per slot for PLS");

            InterstellarLogisticsStationMaxItemKinds = Config.Bind("InterstellarStation", "MaxItemKinds", 6, "Number of slots for ILS (Max 6)");
            InterstellarLogisticsStationMaxItemCount = Config.Bind("InterstellarStation", "MaxItemCount", 10000, "Capacity per slot for ILS");

            _harmony = new Harmony("sebdalf.dsp.betterlogisticsstation");
            try
            {
                _harmony.PatchAll();
                logger.LogInfo("BetterLogisticsStation: Patches Applied Successfully");
            }
            catch (Exception e)
            {
                logger.LogError("BetterLogisticsStation: Patching FAILED: " + e);
            }

            LDBTool.EditDataAction += Edit;
        }
        private void Edit(Proto proto)
        {
            if (proto is ItemProto itemProto && itemProto.prefabDesc != null && itemProto.prefabDesc.isStation)
            {
                if (itemProto.prefabDesc.isStellarStation)
                {
                    itemProto.prefabDesc.stationMaxItemKinds = Math.Min(InterstellarLogisticsStationMaxItemKinds.Value, 6);
                    itemProto.prefabDesc.stationMaxItemCount = InterstellarLogisticsStationMaxItemCount.Value;
                }
                else
                {
                    itemProto.prefabDesc.stationMaxItemKinds = Math.Min(PlanetaryLogisticsStationMaxItemKinds.Value, 6);
                    itemProto.prefabDesc.stationMaxItemCount = PlanetaryLogisticsStationMaxItemCount.Value;
                }
            }
        }
    }
}