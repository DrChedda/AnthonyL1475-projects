using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace SharpChedda
{
    public static class Utils
    {
        public static bool IsSandboxGame()
        {
            return GameMain.data?.gameDesc != null && GameMain.data.gameDesc.isSandboxMode;
        }

        public static void DisableKeepModeIfNeeded(StationComponent station)
        {
            if (station?.storage == null || IsSandboxGame())
            {
                return;
            }

            for (int i = 0; i < station.storage.Length; i++)
            {
                station.storage[i].keepMode = 0;
                station.storage[i].keepIncRatio = 0f;
            }
        }

        public static bool IsItemInNeeds(
            int itemId,
            int[] needs,
            bool valueOnNull = true)
        {
            if (needs == null)
            {
                return valueOnNull;
            }
            foreach (int need in needs)
            {
                if (need == itemId)
                {
                    return true;
                }
            }
            return false;
        }
    }
}
