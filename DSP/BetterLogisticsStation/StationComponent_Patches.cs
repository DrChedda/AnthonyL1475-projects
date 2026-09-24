using HarmonyLib;
using System.IO;
using System.Linq;
using System.Reflection;

namespace sebdalf
{
    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.Init))]
    public static class StationComponent_Init_Patch
    {
        public static void Postfix(StationComponent __instance)
        {
            __instance.needs = new int[__instance.storage.Length + 1];
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
    [HarmonyPatch(nameof(StationComponent.AddItem))]
    public static class StationComponent_AddItem_Patch
    {
        [HarmonyPrefix]
        public static bool Prefix(
            StationComponent __instance,
            int itemId,
            int count,
            int inc,
            ref int __result)
        {
            __result = Custom_AddItem(__instance, itemId, count, inc);
            return false;
        }
        private static int Custom_AddItem(StationComponent __instance, int itemId, int count, int inc)
        {
            if (itemId <= 0)
            {
                return 0;
            }

            lock (__instance.storage)
            {
                int num = __instance.storage.Length;
                for (int storageIndex = 0; storageIndex < num; ++storageIndex)
                {
                    if (__instance.storage[storageIndex].itemId == itemId)
                    {
                        __instance.storage[storageIndex].count = count;
                        __instance.storage[storageIndex].inc = inc;
                        return count;
                    }
                }
            }

            return 0;
        }
    }

    [HarmonyPatch]
    public static class StationComponent_TakeItem_Patch
    {
        static MethodBase TargetMethod()
        {
            return AccessTools.Method(
                typeof(StationComponent),
                "TakeItem",
                new[]
                {
                    typeof(int).MakeByRefType(),
                    typeof(int).MakeByRefType(),
                    typeof(int[]),
                    typeof(int).MakeByRefType()
                }
            );
        }

        [HarmonyPrefix]
        public static bool Prefix(
            StationComponent __instance,
            ref int _itemId,
            ref int _count,
            int[] _needs,
            ref int _inc)
        {
            Custom_TakeItem(__instance, ref _itemId, ref _count, _needs, out _inc);
            return false;
        }

        private static void Custom_TakeItem(StationComponent __instance, ref int _itemId, ref int _count, int[] _needs, out int _inc)
        {
            _inc = 0;
            if (_itemId > 0 && _count > 0 && Utils.IsItemInNeeds(_itemId, _needs))
            {
                lock (__instance.storage)
                {
                    int num = __instance.storage.Length;
                    for (int i = 0; i < num; i++)
                    {
                        if (__instance.storage[i].itemId == _itemId && __instance.storage[i].count > 0)
                        {
                            _count = ((_count < __instance.storage[i].count) ? _count : __instance.storage[i].count);
                            _itemId = __instance.storage[i].itemId;
                            _inc = split_inc(ref __instance.storage[i].count, ref __instance.storage[i].inc, _count);
                            return;
                        }
                    }
                }
            }

            _itemId = 0;
            _count = 0;
            _inc = 0;
        }

        static private int split_inc(ref int n, ref int m, int p)
        {
            if (n == 0)
            {
                return 0;
            }

            int num = m / n;
            int num2 = m - num * n;
            n -= p;
            num2 -= n;
            num = ((num2 > 0) ? (num * p + num2) : (num * p));
            m -= num;
            return num;
        }
    }

    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.HasLocalSupply))]
    public static class StationComponent_HasLocalSupply_Patch
    {
        public static bool Prefix(
            StationComponent __instance,
            int itemId, int countAtLeast,
            ref int __result)
        {
            int num = __instance.storage.Length;
            for (int storageIndex = 0; storageIndex < num; ++storageIndex)
            {
                if (__instance.storage[storageIndex].itemId == itemId && __instance.storage[storageIndex].localLogic == ELogisticStorage.Supply && __instance.storage[storageIndex].count >= countAtLeast)
                {
                    __result = storageIndex;
                    return false;
                }
            }

            return true;
        }
    }

    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.HasLocalDemand))]
    public static class StationComponent_HasLocalDemand_Patch
    {
        public static bool Prefix(
            StationComponent __instance,
            int itemId, int countAtLeast,
            ref int __result)
        {
            int num = __instance.storage.Length;
            for (int storageIndex = 0; storageIndex < num; ++storageIndex)
            {
                if (__instance.storage[storageIndex].itemId == itemId && __instance.storage[storageIndex].localLogic == ELogisticStorage.Demand && __instance.storage[storageIndex].max - __instance.storage[storageIndex].count >= countAtLeast)
                {
                    __result = storageIndex;
                    return false;
                }
            }

            return true;
        }
    }

    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.HasRemoteSupply))]
    public static class StationComponent_HasRemoteSupply_Patch
    {
        public static bool Prefix(
            StationComponent __instance,
            int itemId, int countAtLeast,
            ref int __result)
        {
            int num = __instance.storage.Length;
            for (int storageIndex = 0; storageIndex < num; ++storageIndex)
            {
                if (__instance.storage[storageIndex].itemId == itemId && __instance.storage[storageIndex].remoteLogic == ELogisticStorage.Supply && __instance.storage[storageIndex].count >= countAtLeast)
                {
                    __result = storageIndex;
                    return false;
                }
            }

            return true;
        }
    }

    [HarmonyPatch(typeof(StationComponent))]
    [HarmonyPatch(nameof(StationComponent.HasRemoteDemand))]
    public static class StationComponent_HasRemoteDemand_Patch
    {
        public static bool Prefix(
            StationComponent __instance,
            int itemId, int countAtLeast,
            ref int __result)
        {
            int num = __instance.storage.Length;
            for (int storageIndex = 0; storageIndex < num; ++storageIndex)
            {
                if (__instance.storage[storageIndex].itemId == itemId && __instance.storage[storageIndex].remoteLogic == ELogisticStorage.Demand && __instance.storage[storageIndex].max - __instance.storage[storageIndex].count >= countAtLeast)
                {
                    __result = storageIndex;
                    return false;
                }
            }

            return true;
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
