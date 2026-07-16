"""Shared buffer-reading helpers for opcode-loop config definition decoders.

OSRS config definitions (item/npc/object/...) are encoded as a loop of
(opcode: u1, ...opcode-specific fields...) terminated by opcode 0.
"""

from __future__ import annotations


class DefinitionReader:
    def __init__(self, data: bytes) -> None:
        self._data = data
        self.pos = 0

    def has_more(self) -> bool:
        return self.pos < len(self._data)

    def u1(self) -> int:
        v = self._data[self.pos]
        self.pos += 1
        return v

    def s1(self) -> int:
        v = self.u1()
        return v - 256 if v > 127 else v

    def u2(self) -> int:
        v = int.from_bytes(self._data[self.pos : self.pos + 2], "big")
        self.pos += 2
        return v

    def s2(self) -> int:
        v = self.u2()
        return v - 65536 if v > 32767 else v

    def u3(self) -> int:
        v = int.from_bytes(self._data[self.pos : self.pos + 3], "big")
        self.pos += 3
        return v

    def u4(self) -> int:
        v = int.from_bytes(self._data[self.pos : self.pos + 4], "big")
        self.pos += 4
        return v

    def s4(self) -> int:
        v = int.from_bytes(self._data[self.pos : self.pos + 4], "big", signed=True)
        self.pos += 4
        return v

    def s8(self) -> int:
        v = int.from_bytes(self._data[self.pos : self.pos + 8], "big", signed=True)
        self.pos += 8
        return v

    def var_int2(self) -> int:
        """Little-endian 7-bit groups, continuing while a byte's high bit is set."""
        value = 0
        bits = 0
        while True:
            read = self.u1()
            value |= (read & 0x7F) << bits
            bits += 7
            if read <= 127:
                return value

    def params(self) -> dict[int, int | str]:
        """A parameter bag: count, then (isString, 24-bit key, int/long/string value)."""
        result: dict[int, int | str] = {}
        for _ in range(self.u1()):
            is_string = self.u1()
            key = self.u3()
            if is_string == 1:
                result[key] = self.jstring()
            elif is_string == 2:
                result[key] = self.s8()
            else:
                result[key] = self.s4()
        return result

    def jstring(self) -> str:
        """A CP1252-encoded, null-terminated string."""
        start = self.pos
        end = self._data.index(0x00, start)
        self.pos = end + 1
        return self._data[start:end].decode("cp1252", errors="replace")

    def skip(self, n: int) -> None:
        self.pos += n

    def seek(self, pos: int) -> None:
        self.pos = pos

    def short_smart_signed(self) -> int:
        """1 byte (biased by -64) if the next byte's high bit is clear, else 2 bytes (biased by -0xc000)."""
        if self._data[self.pos] < 128:
            return self.u1() - 64
        return self.u2() - 0xC000

    def peek_signed_byte(self) -> int:
        v = self._data[self.pos]
        return v - 256 if v > 127 else v

    def big_smart2(self) -> int:
        """4 bytes (top bit masked) if the next byte's sign bit is set, else 2 bytes."""
        if self.peek_signed_byte() < 0:
            return self.u4() & 0x7FFFFFFF
        return self.u2()

    def ushort_smart_minus_one(self) -> int:
        if self._data[self.pos] < 0x80:
            return self.u1()
        return self.u2()

    def ushort_smart(self) -> int:
        """1 byte if the next byte's high bit is clear, else 2 bytes biased by -0x8000."""
        if self._data[self.pos] < 128:
            return self.u1()
        return self.u2() - 0x8000

    def uint_smart_short_compat(self) -> int:
        """Sums ushort_smart values while each reads the 32767 continuation sentinel."""
        total = 0
        while True:
            value = self.ushort_smart()
            if value != 32767:
                return total + value
            total += 32767
