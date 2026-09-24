using HarmonyLib;
using System;
using System.Reflection;

namespace sebdalf
{
    [HarmonyPatch(typeof(CargoPath))]
    [HarmonyPatch(nameof(CargoPath.TryPickItemAtRear))]
    public static class CargoPath_TryPickItemAtRear_Patch
    {
        public static readonly AccessTools.FieldRef<CargoPath, int> bufferLengthRef =
        AccessTools.FieldRefAccess<CargoPath, int>("bufferLength");

        public static readonly AccessTools.FieldRef<CargoPath, int> updateLenRef =
        AccessTools.FieldRefAccess<CargoPath, int>("updateLen");

        public static bool Prefix(
            CargoPath __instance,
            int[] needs,
            ref int needIdx,
            ref byte stack,
            ref byte inc,
            ref int __result
            )
        {
            __result = Custom_TryPickItemAtRear(__instance, needs, out needIdx, out stack, out inc);
            return false;
        }
        private static int Custom_TryPickItemAtRear(
            CargoPath __instance,
            int[] needs,
            out int needIdx,
            out byte stack,
            out byte inc)
        {
            lock (__instance.buffer)
            {
                stack = 1;
                inc = 0;
                needIdx = -1;
                if (__instance.buffer[bufferLengthRef(__instance) - 5 - 1] == 250)
                {
                    int num = bufferLengthRef(__instance) - 5 - 1;
                    int num2 = __instance.buffer[num + 1] - 1 + (__instance.buffer[num + 2] - 1) * 100 + (__instance.buffer[num + 3] - 1) * 10000 + (__instance.buffer[num + 4] - 1) * 1000000;
                    int item = __instance.cargoContainer.cargoPool[num2].item;
                    stack = __instance.cargoContainer.cargoPool[num2].stack;
                    inc = __instance.cargoContainer.cargoPool[num2].inc;

                    for (int needIndex = 0; needIndex < needs.Length; ++needIndex)
                    {
                        if (item == needs[needIndex])
                        {
                            Array.Clear(__instance.buffer, num - 4, 10);
                            int num3 = num + 5 + 1;
                            if (updateLenRef(__instance) < num3)
                            {
                                updateLenRef(__instance) = num3;
                            }

                            __instance.cargoContainer.RemoveCargo(num2);
                            needIdx = needIndex;
                            return item;
                        }
                    }
                }
            }
            return 0;
        }
    }

    [HarmonyPatch]
    public static class CargoPath_TryPickItem_Patch
    {
        static MethodBase TargetMethod()
        {
            return AccessTools.Method(
                typeof(CargoPath),
                "TryPickItem",
                new[]
                {
                typeof(int),
                typeof(int),
                typeof(int),
                typeof(int[]),
                typeof(byte).MakeByRefType(),
                typeof(byte).MakeByRefType()
                }
            );
        }

        public static readonly AccessTools.FieldRef<CargoPath, int> bufferLengthRef =
        AccessTools.FieldRefAccess<CargoPath, int>("bufferLength");

        public static readonly AccessTools.FieldRef<CargoPath, int> updateLenRef =
        AccessTools.FieldRefAccess<CargoPath, int>("updateLen");

        public static bool Prefix(
            CargoPath __instance,
            int index,
            int length,
            int filter,
            int[] needs,
            ref byte stack,
            ref byte inc,
            ref int __result
            )
        {
            __result = Custom_TryPickItem(__instance, index, length, filter, needs, out stack, out inc);
            return false;
        }

        private static int Custom_TryPickItem(
            CargoPath __instance,
            int index,
            int length,
            int filter,
            int[] needs,
            out byte stack,
            out byte inc)
        {
            lock (__instance.buffer)
            {
                stack = 1;
                inc = 0;
                if (index < 0)
                {
                    index = 0;
                }
                else if (index >= bufferLengthRef(__instance))
                {
                    index = bufferLengthRef(__instance) - 1;
                }

                int num = index + length;
                if (num > bufferLengthRef(__instance))
                {
                    num = bufferLengthRef(__instance);
                }

                for (int i = index; i < num; i++)
                {
                    if (__instance.buffer[i] < 246)
                    {
                        continue;
                    }

                    i += 250 - __instance.buffer[i];
                    int num2 = __instance.buffer[i + 1] - 1 + (__instance.buffer[i + 2] - 1) * 100 + (__instance.buffer[i + 3] - 1) * 10000 + (__instance.buffer[i + 4] - 1) * 1000000;
                    int item = __instance.cargoContainer.cargoPool[num2].item;
                    stack = __instance.cargoContainer.cargoPool[num2].stack;
                    inc = __instance.cargoContainer.cargoPool[num2].inc;
                    if ((filter == 0 || item == filter) && Utils.IsItemInNeeds(item, needs, false))
                    {
                        Array.Clear(__instance.buffer, i - 4, 10);
                        int num3 = i + 5 + 1;
                        if (updateLenRef(__instance) < num3)
                        {
                            updateLenRef(__instance) = num3;
                        }

                        __instance.cargoContainer.RemoveCargo(num2);
                        return item;
                    }

                    return 0;
                }
            }

            return 0;
        }
    }

    [HarmonyPatch(typeof(CargoPath))]
    [HarmonyPatch(nameof(CargoPath.CanPickItemFromRear))]
    public static class CargoPath_CanPickItemFromRear_Patch
    {
        public static readonly AccessTools.FieldRef<CargoPath, int> bufferLengthRef =
        AccessTools.FieldRefAccess<CargoPath, int>("bufferLength");

        public static bool Prefix(
            CargoPath __instance,
            int[] needs,
            ref bool __result
            )
        {
            __result = Custom_CanPickItemFromRear(__instance, needs);
            return false;
        }

        private static bool Custom_CanPickItemFromRear(
            CargoPath __instance,
            int[] needs)
        {
            int num = bufferLengthRef(__instance) - 5 - 1;
            if (__instance.buffer[num] == 250)
            {
                int num2 = __instance.buffer[num + 1] - 1 + (__instance.buffer[num + 2] - 1) * 100 + (__instance.buffer[num + 3] - 1) * 10000 + (__instance.buffer[num + 4] - 1) * 1000000;
                int item = __instance.cargoContainer.cargoPool[num2].item;
                if (item == 0)
                {
                    return false;
                }

                if (Utils.IsItemInNeeds(item, needs, false))
                {
                    return true;
                }
            }

            return false;
        }
    }
}
