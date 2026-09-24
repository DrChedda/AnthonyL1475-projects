using HarmonyLib;
using System;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using xiaoye97;

namespace sebdalf
{

    [BepInDependency("me.xiaoye97.plugin.Dyson.LDBTool", BepInDependency.DependencyFlags.HardDependency)]
    [BepInPlugin("sebdalf.dsp.betterlogisticsstation", "DSP Better Logistics Station", "1.0.0")]
    [BepInProcess("DSPGAME.exe")]
    public class BetterLogisticsStation: BaseUnityPlugin
    {
        private Harmony _harmony;
        private void Awake()
        {
            _harmony = new Harmony("sebdalf.dsp.betterlogisticsstation");
            try
            {
                _harmony.PatchAll();
                Logger.LogInfo("BetterLogisticsStation: Harmony.PatchAll() done");
            }
            catch (Exception e)
            {
                Logger.LogError("BetterLogisticsStation: Harmony.PatchAll() FAILED: " + e);
            }
        }

        private void Start()
        {
            BetterLogisticsStation.logger = base.Logger;
            BetterLogisticsStation.PlanetaryLogisticsStationMaxItemKinds = base.Config.Bind<int>("General", "PlanetaryLogisticsStationMaxItemKinds", 6, "Number of different items planetary logistics stations can hold, shouldn't be larger than 6");
            BetterLogisticsStation.PlanetaryLogisticsStationMaxItemCount = base.Config.Bind<int>("General", "PlanetaryLogisticsStationMaxItemCount", 5000, "Capacity the planetary logistics station can hold of one item");
            BetterLogisticsStation.InterstellarLogisticsStationMaxItemKinds = base.Config.Bind<int>("General", "InterstellarLogisticsStationMaxItemKinds", 6, "Number of different items interstellar logistics stations can hold, shouldn't be larger than 6");
            BetterLogisticsStation.InterstellarLogisticsStationMaxItemCount = base.Config.Bind<int>("General", "InterstellarLogisticsStationMaxItemCount", 10000, "Capacity the interstellar logistics station can hold of one item");
            LDBTool.EditDataAction = (Action<Proto>)Delegate.Combine(LDBTool.EditDataAction, new Action<Proto>(this.Edit));
            BetterLogisticsStation.logger.LogInfo("BetterLogisticStations loaded!");
        }

        private void Edit(Proto proto)
        {
            bool flag = proto is ItemProto;
            if (flag)
            {
                ItemProto itemProto = proto as ItemProto;
                bool isStation = itemProto.prefabDesc.isStation;
                if (isStation)
                {
                    bool isStellarStation = itemProto.prefabDesc.isStellarStation;
                    if (isStellarStation)
                    {
                        itemProto.prefabDesc.stationMaxItemKinds = BetterLogisticsStation.InterstellarLogisticsStationMaxItemKinds.Value;
                        itemProto.prefabDesc.stationMaxItemCount = BetterLogisticsStation.InterstellarLogisticsStationMaxItemCount.Value;
                    }
                    else
                    {
                        itemProto.prefabDesc.stationMaxItemKinds = BetterLogisticsStation.PlanetaryLogisticsStationMaxItemKinds.Value;
                        itemProto.prefabDesc.stationMaxItemCount = BetterLogisticsStation.PlanetaryLogisticsStationMaxItemCount.Value;
                    }
                }
            }
        }

        internal static ManualLogSource logger;

        private static ConfigEntry<int> PlanetaryLogisticsStationMaxItemKinds;
        private static ConfigEntry<int> PlanetaryLogisticsStationMaxItemCount;
        private static ConfigEntry<int> InterstellarLogisticsStationMaxItemKinds;
        private static ConfigEntry<int> InterstellarLogisticsStationMaxItemCount;
    }
}
