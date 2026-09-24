using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace sebdalf
{
    public static class Utils
    {
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