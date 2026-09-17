const SalaryStructure = require('../models/SalaryStructure');

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get all salary structures
// @route   GET /api/salary-structures
// @access  Private (Admin, HR, Finance)
// ─────────────────────────────────────────────────────────────────────────────
const getAllStructures = async (req, res) => {
  try {
    const structures = await SalaryStructure.find({}).sort({ role: 1, designation: 1 });
    res.json(structures);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Upsert a salary structure (create or update)
// @route   PUT /api/salary-structures
// @access  Private (Admin, HR, Finance)
// ─────────────────────────────────────────────────────────────────────────────
const upsertStructure = async (req, res) => {
  try {
    const { role, designation, basicSalary, pfAmount, mediclaimAmount } = req.body;

    if (!role || !designation) {
      return res.status(400).json({ message: 'Role and Designation are required' });
    }
    if (basicSalary === undefined || basicSalary === null || basicSalary < 0) {
      return res.status(400).json({ message: 'A valid Basic Salary is required' });
    }

    const structure = await SalaryStructure.findOneAndUpdate(
      { role: role.trim(), designation: designation.trim() },
      {
        $set: {
          basicSalary: Number(basicSalary) || 0,
          pfAmount: Number(pfAmount) || 0,
          mediclaimAmount: Number(mediclaimAmount) || 0,
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(structure);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Delete a salary structure
// @route   DELETE /api/salary-structures/:id
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const deleteStructure = async (req, res) => {
  try {
    const structure = await SalaryStructure.findByIdAndDelete(req.params.id);
    if (!structure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }
    res.json({ message: 'Salary structure deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Fetch salary for a specific role+designation (used by Add Employee form)
// @route   GET /api/salary-structures/lookup?role=X&designation=Y
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const lookupSalary = async (req, res) => {
  try {
    const { role, designation } = req.query;
    if (!role || !designation) {
      return res.json({ found: false });
    }

    const structure = await SalaryStructure.findOne({
      role: role.trim(),
      designation: designation.trim(),
    });

    if (structure) {
      return res.json({
        found: true,
        basicSalary: structure.basicSalary,
        pfAmount: structure.pfAmount,
        mediclaimAmount: structure.mediclaimAmount,
      });
    }

    res.json({ found: false });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllStructures,
  upsertStructure,
  deleteStructure,
  lookupSalary,
};
