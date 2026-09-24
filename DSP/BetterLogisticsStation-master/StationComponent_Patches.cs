using HarmonyLib;
using System.IO;
using System.Linq;
using System.Reflection;

namespace SharpChedda
{
    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.Init))]
    public static class StationComponent_Init_Patch
    {
        public static void Postfix(StationComponent __instance)
        {
            int newSize = __instance.storage.Length;
            __instance.needs = new int[newSize + 1];
        }
    }

    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.Import))]
    [HarmonyPatch(new[] { typeof(BinaryReader) })]
    public static class StationComponent_Import_Patch
    {
        public static void Postfix(StationComponent __instance)
        {
            __instance.needs = new int[__instance.storage.Length + 1];
            Utils.DisableKeepModeIfNeeded(__instance);
        }
    }

    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.InitSettings))]
    public static class StationComponent_InitSettings_Patch
    {
        public static void Postfix(StationComponent __instance)
        {
            Utils.DisableKeepModeIfNeeded(__instance);
        }
    }

    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.UpdateNeeds))]
    public static class StationComponent_UpdateNeeds_Patch
    {
        public static bool Prefix(StationComponent __instance)
        {
            lock (__instance.storage)
            {
                int num = __instance.needs.Length;

                for (int needIndex = 0; needIndex < num - 1; ++needIndex)
                {
                    __instance.needs[needIndex] = ((__instance.storage[needIndex].count < __instance.storage[needIndex].max) ? __instance.storage[needIndex].itemId : 0); ;
                }

                __instance.needs[num - 1] = ((__instance.isStellar && __instance.warperCount < __instance.warperMaxCount) ? 1210 : 0);
            }
            return false;
        }
    }

  
    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.UpdateInputSlots))]
    public static class StationComponent_UpdateInputSlots_Patch
    {
        public static bool Prefix(
            StationComponent __instance,
            CargoTraffic traffic,
            SignData[] signPool,
            bool active)
        {
            lock (__instance.storage)
            {
                int num = __instance.slots.Length;
                BeltComponent[] beltPool = traffic.beltPool;
                int num2 = __instance.needs.Sum();
                for (int i = 0; i < num; i++)
                {
                    ref SlotData reference = ref __instance.slots[i];
                    if (reference.dir == IODir.Input)
                    {
                        if (reference.counter > 0)
                        {
                            reference.counter--;
                        }
                        else
                        {
                            if (num2 == 0 || reference.beltId == 0)
                            {
                                continue;
                            }

                            ref BeltComponent reference2 = ref beltPool[reference.beltId];
                            CargoPath cargoPath = traffic.GetCargoPath(reference2.segPathId);
                            if (cargoPath == null)
                            {
                                continue;
                            }

                            int needIdx = -1;
                            byte stack;
                            byte inc;
                            int num3 = cargoPath.TryPickItemAtRear(__instance.needs, out needIdx, out stack, out inc);
                            if (needIdx >= 0)
                            {
                                __instance.InputItem(num3, needIdx, stack, inc);
                                reference.storageIdx = needIdx + 1;
                                reference.counter = 1;
                            }

                            if (active)
                            {
                                if (__instance.isVeinCollector)
                                {
                                    ref SignData reference3 = ref signPool[reference2.entityId];
                                    reference3.iconType = 0u;
                                    reference3.iconId0 = 0u;
                                }
                                else if (num3 > 0)
                                {
                                    ref SignData reference4 = ref signPool[reference2.entityId];
                                    reference4.iconType = 1u;
                                    reference4.iconId0 = (uint)num3;
                                }
                            }
                        }
                    }
                    else if (reference.dir != IODir.Output)
                    {
                        reference.beltId = 0;
                        reference.counter = 0;
                    }
                }
            }
            return false;
        }
    }
}
