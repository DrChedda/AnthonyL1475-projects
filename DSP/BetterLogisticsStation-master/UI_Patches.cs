using HarmonyLib;
using UnityEngine;
using System.Reflection;

namespace SharpChedda
{
    [HarmonyPatch(typeof(UIStationWindow), "_OnOpen")]
    public static class UIStationWindow_Simple_Patch
    {
        [HarmonyPostfix]
        public static void OnOpenPostfix(UIStationWindow __instance)
        {
            FieldInfo groupCountField = typeof(UIStationWindow).GetField("groupCount", BindingFlags.Instance | BindingFlags.NonPublic);
            FieldInfo stationIdField = typeof(UIStationWindow).GetField("_stationId", BindingFlags.Instance | BindingFlags.NonPublic);

            if (stationIdField == null) return;

            int stationId = (int)stationIdField.GetValue(__instance);
            if (stationId <= 0) return;

            PlanetFactory factory = GameMain.mainPlayer.factory;
            StationComponent station = factory.transport.GetStationComponent(stationId);
            if (station == null) return;

            int itemId = factory.entityPool[station.entityId].protoId;
            ItemProto proto = LDB.items.Select(itemId);
            int slotCount = proto.prefabDesc.stationMaxItemKinds;

            if (groupCountField != null) groupCountField.SetValue(__instance, slotCount);

            Transform storageGroup = __instance.transform.Find("storage-group");
            if (storageGroup != null)
            {
                RectTransform rect = storageGroup.GetComponent<RectTransform>();
                rect.sizeDelta = new Vector2(rect.sizeDelta.x, (float)slotCount * 76f);
            }
        }
    }

    [HarmonyPatch(typeof(UIStationStorage), "RefreshValues")]
    public static class UIStationStorage_RefreshValues_Patch
    {
        [HarmonyPostfix]
        public static void RefreshValuesPostfix(UIStationStorage __instance)
        {
            if (__instance?.keepModeButton?.button == null)
            {
                return;
            }

            __instance.keepModeButton.button.interactable = Utils.IsSandboxGame();
            __instance.keepModeButton.RefreshTransitionsImmediately();
        }
    }

    [HarmonyPatch(typeof(UIStationStorage), "OnKeepModeButtonClick")]
    public static class UIStationStorage_OnKeepModeButtonClick_Patch
    {
        [HarmonyPrefix]
        public static bool Prefix()
        {
            return Utils.IsSandboxGame();
        }
    }
}
